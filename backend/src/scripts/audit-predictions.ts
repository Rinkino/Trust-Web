/**
 * Prediction audit script
 *
 * For every Sportybet prediction:
 *   - Scrapes real status from ConvertBetCodes bet-viewer
 *   - Compares against stored status
 *   - Flags mismatches
 *   - Resolves PENDING predictions that have a real outcome
 *
 * Run: npx tsx --env-file=.env src/scripts/audit-predictions.ts
 */

import { createClient } from '@supabase/supabase-js'
import { fetchSporbetSlip } from '../services/platforms/sportybet'
import { calculateScoreUpdate, ScoringContext } from '../services/scoring'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function resolveInDb(prediction: any, result: 'WON' | 'LOST' | 'VOID') {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', prediction.user_id)
    .single()

  if (!profile) {
    console.log(`  ⚠️  No profile for user ${prediction.user_id} — skipping score update`)
    await supabase.from('predictions').update({
      status: result,
      resolved_at: new Date().toISOString(),
    }).eq('id', prediction.id)
    return
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

  await supabase.from('predictions').update({
    status: result,
    resolved_at: new Date().toISOString(),
    score_contribution: result !== 'VOID' ? scoring.creditDelta : 0,
  }).eq('id', prediction.id)

  const totalResolved = result !== 'VOID' ? profile.total_resolved + 1 : profile.total_resolved
  const totalCorrect  = result === 'WON'  ? profile.total_correct  + 1 : profile.total_correct

  await supabase.from('profiles').update({
    credit_score:     scoring.newCreditScore,
    visibility_score: scoring.newVisibilityScore,
    correct_streak:   scoring.newCorrectStreak,
    wrong_streak:     scoring.newWrongStreak,
    best_streak_ever: Math.max(profile.best_streak_ever, scoring.newCorrectStreak),
    total_resolved:   totalResolved,
    total_correct:    totalCorrect,
    last_resolved_at: new Date().toISOString(),
    user_state:       result === 'WON' ? 'ACTIVE' : 'DECAYING',
  }).eq('id', prediction.user_id)

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
}

async function main() {
  const { data: predictions, error } = await supabase
    .from('predictions')
    .select('*')
    .eq('platform', 'Sportybet')
    .order('locked_at', { ascending: false })

  if (error || !predictions) {
    console.error('Failed to fetch predictions:', error?.message)
    process.exit(1)
  }

  console.log(`\nAuditing ${predictions.length} Sportybet prediction(s)...\n`)

  const results = {
    correct:   [] as string[],
    fixed:     [] as string[],
    mismatch:  [] as string[],
    failed:    [] as string[],
  }

  for (const pred of predictions) {
    process.stdout.write(`[${pred.betslip_code}] stored=${pred.status} → checking... `)

    try {
      const slip = await fetchSporbetSlip(pred.betslip_code)
      const real = slip.status

      if (real === pred.status) {
        console.log(`✓ confirmed ${real}`)
        results.correct.push(pred.betslip_code)

      } else if (pred.status === 'PENDING' && real !== 'PENDING') {
        // Pending but actually resolved — fix it
        console.log(`→ resolving as ${real}`)
        await resolveInDb(pred, real)
        results.fixed.push(`${pred.betslip_code}: PENDING → ${real}`)

      } else {
        // Already resolved but scraper disagrees — flag, don't auto-fix
        console.log(`⚠️  MISMATCH — stored=${pred.status}, scraper=${real}`)
        results.mismatch.push(`${pred.betslip_code}: stored=${pred.status}, real=${real}`)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.log(`✗ error: ${msg}`)
      results.failed.push(`${pred.betslip_code}: ${msg}`)
    }

    // Rate limit — avoid hammering Sportybet
    await sleep(3000)
  }

  console.log('\n─────────────────────────────────')
  console.log(`✓ Confirmed correct : ${results.correct.length}`)
  console.log(`→ Fixed (PENDING→resolved): ${results.fixed.length}`)
  if (results.fixed.length)    results.fixed.forEach(r => console.log(`   ${r}`))
  console.log(`⚠️  Mismatches        : ${results.mismatch.length}`)
  if (results.mismatch.length) results.mismatch.forEach(r => console.log(`   ${r}`))
  console.log(`✗ Errors             : ${results.failed.length}`)
  if (results.failed.length)   results.failed.forEach(r => console.log(`   ${r}`))
  console.log('─────────────────────────────────\n')

  process.exit(0)
}

main().catch(err => {
  console.error('Unhandled error:', err)
  process.exit(1)
})
