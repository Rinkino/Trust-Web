import cron from 'node-cron'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { fetchPolymarketMarketById } from './platforms/polymarket'
import { getFixtureResult, determineOutcome } from './platforms/apisports'
import { calculateScoreUpdate, ScoringContext } from './scoring'

function getSupabase(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

// ---------------------------------------------------------------------------
// Shared resolution helper
// Applies scoring, updates profile, writes score_history, strips leg data.
// ---------------------------------------------------------------------------

export async function applyResolution(
  supabase: SupabaseClient,
  prediction: { id: string; user_id: string; odds: number },
  result: 'WON' | 'LOST' | 'VOID',
): Promise<void> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', prediction.user_id)
    .single()

  if (profileError || !profile) {
    console.error(`[resolver] Profile not found for user ${prediction.user_id}`)
    return
  }

  const ctx: ScoringContext = {
    currentCreditScore:     profile.credit_score,
    currentVisibilityScore: profile.visibility_score,
    totalResolved:          profile.total_resolved,
    correctStreak:          profile.correct_streak,
    wrongStreak:            profile.wrong_streak,
    bestStreakEver:         profile.best_streak_ever,
    daysInactive:           profile.days_inactive,
  }

  const scoring = calculateScoreUpdate(result, prediction.odds, ctx)
  const now     = new Date().toISOString()

  await supabase
    .from('predictions')
    .update({
      status:             result,
      resolved_at:        now,
      score_contribution: scoring.creditDelta,
      legs:               null,   // strip working metadata after resolution
    })
    .eq('id', prediction.id)

  const totalResolved = result !== 'VOID' ? profile.total_resolved + 1 : profile.total_resolved
  const totalCorrect  = result === 'WON'  ? profile.total_correct  + 1 : profile.total_correct

  await supabase
    .from('profiles')
    .update({
      credit_score:      scoring.newCreditScore,
      visibility_score:  scoring.newVisibilityScore,
      correct_streak:    scoring.newCorrectStreak,
      wrong_streak:      scoring.newWrongStreak,
      best_streak_ever:  Math.max(profile.best_streak_ever, scoring.newCorrectStreak),
      total_resolved:    totalResolved,
      total_correct:     totalCorrect,
      last_resolved_at:  now,
      user_state:        result === 'WON' ? 'ACTIVE' : 'DECAYING',
    })
    .eq('id', prediction.user_id)

  await supabase.from('score_history').insert({
    user_id:           prediction.user_id,
    prediction_id:     prediction.id,
    credit_before:     ctx.currentCreditScore,
    credit_after:      scoring.newCreditScore,
    credit_delta:      scoring.creditDelta,
    visibility_before: ctx.currentVisibilityScore,
    visibility_after:  scoring.newVisibilityScore,
    visibility_delta:  scoring.visibilityDelta,
    result,
  })

  console.log(`[resolver] ${prediction.id} → ${result}`)
}

// ---------------------------------------------------------------------------
// Polymarket resolver (unchanged logic, uses applyResolution helper)
// ---------------------------------------------------------------------------

async function resolvePolymarketPredictions(): Promise<void> {
  const supabase = getSupabase()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('status', 'PENDING')
    .eq('platform', 'Polymarket')
    .not('market_id', 'is', null)

  if (error) {
    console.error('[resolver] Polymarket fetch error:', error.message)
    return
  }
  if (!predictions?.length) return

  console.log(`[resolver] Checking ${predictions.length} Polymarket prediction(s)`)

  for (const prediction of predictions) {
    try {
      const market = await fetchPolymarketMarketById(prediction.market_id)
      if (!market.closed || market.winner === null) continue

      const selection = (prediction.selection || '').toUpperCase()
      const result: 'WON' | 'LOST' = selection === market.winner ? 'WON' : 'LOST'

      await applyResolution(supabase, prediction, result)
    } catch (err) {
      console.error(`[resolver] Polymarket error on ${prediction.id}:`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Sportybet resolver — frequency-based match-score approach
//
// Algorithm:
//  1. Fetch all PENDING Sportybet predictions that have `legs` stored
//  2. Collect every unique fixture_id mentioned across all legs
//  3. Fetch each unique fixture result ONCE (parallel)
//  4. For each prediction:
//       - Any leg LOST → whole slip LOST (accumulator elimination)
//       - No legs LOST, all legs finished → WON
//       - Any leg still PENDING → skip until next cron
//  5. Fall-through: predictions without legs are skipped here
//     (Puppeteer fallback to be wired in once service account exists)
// ---------------------------------------------------------------------------

async function resolveSporbetPredictions(): Promise<void> {
  const supabase = getSupabase()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('id, user_id, odds, legs, event_start_time, needs_review')
    .eq('status', 'PENDING')
    .eq('platform', 'Sportybet')
    .not('legs', 'is', null)

  if (error) {
    console.error('[resolver] Sportybet fetch error:', error.message)
    return
  }
  if (!predictions?.length) return

  console.log(`[resolver] Checking ${predictions.length} Sportybet prediction(s) via match-score`)

  // --- Step 1: collect all unique fixture IDs + their sport across all predictions ---
  const fixtureIdToSport = new Map<number, string>()
  for (const pred of predictions) {
    for (const leg of (pred.legs as any[] || [])) {
      if (leg.fixture_id) {
        fixtureIdToSport.set(leg.fixture_id as number, leg.sport ?? 'football')
      }
    }
  }

  if (fixtureIdToSport.size === 0) return

  console.log(`[resolver] Fetching ${fixtureIdToSport.size} unique fixture result(s)`)

  // --- Step 2: fetch all fixture results in parallel (one call per unique match) ---
  const resultMap = new Map<number, Awaited<ReturnType<typeof getFixtureResult>>>()
  await Promise.all(
    [...fixtureIdToSport.entries()].map(async ([id, sport]) => {
      const r = await getFixtureResult(id, sport)
      resultMap.set(id, r)
    })
  )

  // --- Step 3: evaluate each prediction ---
  for (const pred of predictions) {
    try {
      const legs = pred.legs as any[]

      let anyLost    = false
      let anyPending = false

      for (const leg of legs) {
        // Leg without fixture_id — unsupported market/sport, can't resolve via API
        if (!leg.fixture_id || !leg.market_type || !leg.market_value) {
          anyPending = true
          continue
        }

        const fixtureResult = resultMap.get(leg.fixture_id as number)
        if (!fixtureResult) { anyPending = true; continue }

        const outcome = determineOutcome(fixtureResult, leg.market_type, leg.market_value)

        if (outcome === 'LOST')    { anyLost    = true; break }
        if (outcome === 'PENDING') { anyPending = true         }
      }

      if (anyLost) {
        await applyResolution(supabase, pred, 'LOST')
      } else if (!anyPending) {
        await applyResolution(supabase, pred, 'WON')
      } else {
        // Still pending — check if the event is long overdue and flag for manual review
        const eventStart    = new Date(pred.event_start_time)
        const hoursPastStart = (Date.now() - eventStart.getTime()) / 3_600_000

        if (hoursPastStart > 12 && !pred.needs_review) {
          await supabase
            .from('predictions')
            .update({
              needs_review: true,
              review_note:  'Fixture result not found via football-data.org or api-sports.io — manual resolution required',
            })
            .eq('id', pred.id)
          console.log(`[resolver] Flagged prediction ${pred.id} for manual review`)
        }
      }
    } catch (err) {
      console.error(`[resolver] Error evaluating prediction ${pred.id}:`, err)
    }
  }
}

// ---------------------------------------------------------------------------
// Cron schedule
// ---------------------------------------------------------------------------

export function startResolutionCron(): void {
  // Polymarket — every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    resolvePolymarketPredictions().catch(err => {
      console.error('[resolver] Polymarket cron error:', err)
    })
  })

  // Sportybet — every 10 minutes
  // Runs against API-Sports; no browser needed
  cron.schedule('*/10 * * * *', () => {
    resolveSporbetPredictions().catch(err => {
      console.error('[resolver] Sportybet cron error:', err)
    })
  })

  console.log('[resolver] Resolution cron started — Polymarket every 5min, Sportybet every 10min')
}
