import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { fetchPolymarketMarketById } from './platforms/polymarket'
import { checkSporbetSlipStatus } from './platforms/sportybet'
import { calculateScoreUpdate, ScoringContext } from './scoring'

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function resolvePolymarketPredictions(): Promise<void> {
  const supabase = getSupabase()

  // Fetch all PENDING Polymarket predictions that have a market_id and selection
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('status', 'PENDING')
    .eq('platform', 'Polymarket')
    .not('market_id', 'is', null)

  if (error) {
    console.error('[resolver] Failed to fetch predictions:', error.message)
    return
  }

  if (!predictions || predictions.length === 0) {
    return
  }

  console.log(`[resolver] Checking ${predictions.length} Polymarket prediction(s)`)

  for (const prediction of predictions) {
    try {
      const market = await fetchPolymarketMarketById(prediction.market_id)

      if (!market.closed || market.winner === null) {
        // Market not yet resolved
        continue
      }

      // Determine result based on user selection vs market winner
      const selection: string = (prediction.selection || '').toUpperCase()
      const result: 'WON' | 'LOST' =
        selection === market.winner ? 'WON' : 'LOST'

      // Fetch user profile for scoring context
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', prediction.user_id)
        .single()

      if (profileError || !profile) {
        console.error(`[resolver] Profile not found for user ${prediction.user_id}`)
        continue
      }

      const ctx: ScoringContext = {
        currentCreditScore:    profile.credit_score,
        currentVisibilityScore: profile.visibility_score,
        totalResolved:         profile.total_resolved,
        correctStreak:         profile.correct_streak,
        wrongStreak:           profile.wrong_streak,
        bestStreakEver:        profile.best_streak_ever,
        daysInactive:          profile.days_inactive,
      }

      const scoring = calculateScoreUpdate(result, prediction.odds, ctx)

      // Update prediction
      const { error: predUpdateError } = await supabase
        .from('predictions')
        .update({
          status:             result,
          resolved_at:        new Date().toISOString(),
          score_contribution: scoring.creditDelta,
        })
        .eq('id', prediction.id)

      if (predUpdateError) {
        console.error(`[resolver] Failed to update prediction ${prediction.id}:`, predUpdateError.message)
        continue
      }

      // Update profile scores
      const totalResolved = profile.total_resolved + 1
      const totalCorrect  = result === 'WON' ? profile.total_correct + 1 : profile.total_correct

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
          last_resolved_at:  new Date().toISOString(),
          user_state:        result === 'WON' ? 'ACTIVE' : 'DECAYING',
        })
        .eq('id', prediction.user_id)

      // Log score history
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

      console.log(`[resolver] Resolved prediction ${prediction.id} as ${result}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[resolver] Error processing prediction ${prediction.id}:`, msg)
      // Continue to next prediction — one failure should not block others
    }
  }
}

async function resolveSporbetPredictions(): Promise<void> {
  const supabase = getSupabase()

  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('status', 'PENDING')
    .eq('platform', 'Sportybet')
    .not('betslip_code', 'is', null)

  if (error) {
    console.error('[resolver] Failed to fetch Sportybet predictions:', error.message)
    return
  }

  if (!predictions || predictions.length === 0) return

  console.log(`[resolver] Checking ${predictions.length} Sportybet prediction(s)`)

  for (const prediction of predictions) {
    try {
      const status = await checkSporbetSlipStatus(prediction.betslip_code)

      if (status === 'PENDING') continue

      const result = status === 'VOID' ? 'VOID' : status

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', prediction.user_id)
        .single()

      if (profileError || !profile) {
        console.error(`[resolver] Profile not found for user ${prediction.user_id}`)
        continue
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

      await supabase
        .from('predictions')
        .update({
          status:             result,
          resolved_at:        new Date().toISOString(),
          score_contribution: scoring.creditDelta,
        })
        .eq('id', prediction.id)

      const totalResolved = result !== 'VOID' ? profile.total_resolved + 1 : profile.total_resolved
      const totalCorrect  = result === 'WON'  ? profile.total_correct  + 1 : profile.total_correct

      await supabase
        .from('profiles')
        .update({
          credit_score:     scoring.newCreditScore,
          visibility_score: scoring.newVisibilityScore,
          correct_streak:   scoring.newCorrectStreak,
          wrong_streak:     scoring.newWrongStreak,
          best_streak_ever: Math.max(profile.best_streak_ever, scoring.newCorrectStreak),
          total_resolved:   totalResolved,
          total_correct:    totalCorrect,
          last_resolved_at: new Date().toISOString(),
          user_state:       result === 'WON' ? 'ACTIVE' : 'DECAYING',
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

      console.log(`[resolver] Sportybet prediction ${prediction.id} resolved as ${result}`)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[resolver] Error processing Sportybet prediction ${prediction.id}:`, msg)
    }
  }
}

export function startResolutionCron(): void {
  // Polymarket — every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    resolvePolymarketPredictions().catch(err => {
      console.error('[resolver] Unhandled Polymarket cron error:', err)
    })
  })

  // Sportybet — every 15 minutes (slower, uses headless browser)
  cron.schedule('*/15 * * * *', () => {
    resolveSporbetPredictions().catch(err => {
      console.error('[resolver] Unhandled Sportybet cron error:', err)
    })
  })

  console.log('[resolver] Resolution cron started — Polymarket every 5min, Sportybet every 15min')
}
