/**
 * Corrects WON predictions that were actually LOST (or unverifiable).
 * - Reverses the credit/visibility gained from the incorrect WON
 * - Applies the correct LOST delta
 * - Updates prediction status + score_history
 *
 * Run: npx tsx --env-file=.env src/scripts/correct-mismatches.ts
 */

import { createClient } from '@supabase/supabase-js'
import { calculateScoreUpdate, ScoringContext } from '../services/scoring'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Predictions confirmed incorrect — stored as WON but should be LOST
const CORRECTIONS = [
  'e66bf4bb-dbd2-45af-bd09-48ab0323ca5e', // J9EAGF
  '9291db33-b2cb-487b-99aa-efe1e2c5f191', // RR6E79
  '82ea6f5c-caec-479d-a618-18dc7ad687fa', // P5BAH9
  'f6c068e3-be9b-4d38-a583-51f4131f60d4', // W23FT5
]

async function main() {
  // Fetch all predictions to correct
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .in('id', CORRECTIONS)

  if (!predictions?.length) {
    console.error('No predictions found'); process.exit(1)
  }

  // Group by user (should all be same user but handle generically)
  const userIds = [...new Set(predictions.map(p => p.user_id))]

  for (const userId of userIds) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) { console.error(`No profile for ${userId}`); continue }

    // Fetch all incorrect WON score_history entries for these predictions
    const predIds = predictions.filter(p => p.user_id === userId).map(p => p.id)
    const { data: history } = await supabase
      .from('score_history')
      .select('*')
      .in('prediction_id', predIds)
      .eq('result', 'WON')

    // Calculate total incorrect credit/visibility that was added
    const incorrectCreditAdded     = history?.reduce((s, h) => s + (h.credit_delta ?? 0), 0) ?? 0
    const incorrectVisibilityAdded = history?.reduce((s, h) => s + (h.visibility_delta ?? 0), 0) ?? 0

    console.log(`\nUser ${userId}`)
    console.log(`  Incorrect credit added:     +${incorrectCreditAdded.toFixed(2)}`)
    console.log(`  Incorrect visibility added: +${incorrectVisibilityAdded.toFixed(2)}`)

    // Revert profile to pre-incorrect-WON state (approx)
    const revertedCredit     = Math.min(100, Math.max(0, profile.credit_score - incorrectCreditAdded))
    const revertedVisibility = Math.max(0, profile.visibility_score - incorrectVisibilityAdded)
    const revertedCorrect    = Math.max(0, profile.total_correct - predIds.length)
    const revertedResolved   = Math.max(0, profile.total_resolved - predIds.length)

    // Now apply LOST for each prediction on top of the reverted base
    let creditScore     = revertedCredit
    let visibilityScore = revertedVisibility
    let correctStreak   = 0
    let wrongStreak     = predIds.length  // all were losses
    let totalResolved   = revertedResolved
    let totalCorrect    = revertedCorrect

    const newHistoryRows = []

    for (const pred of predictions.filter(p => p.user_id === userId)) {
      const ctx: ScoringContext = {
        currentCreditScore:    creditScore,
        currentVisibilityScore: visibilityScore,
        totalResolved,
        correctStreak,
        wrongStreak,
        bestStreakEver:        profile.best_streak_ever,
        daysInactive:          profile.days_inactive,
      }

      const scoring = calculateScoreUpdate('LOST', pred.odds, ctx)

      newHistoryRows.push({
        user_id:           userId,
        prediction_id:     pred.id,
        credit_before:     creditScore,
        credit_after:      scoring.newCreditScore,
        credit_delta:      scoring.creditDelta,
        visibility_before: visibilityScore,
        visibility_after:  scoring.newVisibilityScore,
        visibility_delta:  scoring.visibilityDelta,
        result:            'LOST',
      })

      console.log(`  ${pred.betslip_code}: credit ${creditScore.toFixed(2)} → ${scoring.newCreditScore.toFixed(2)} (${scoring.creditDelta.toFixed(2)})`)

      creditScore     = scoring.newCreditScore
      visibilityScore = scoring.newVisibilityScore
      correctStreak   = scoring.newCorrectStreak
      wrongStreak     = scoring.newWrongStreak
      totalResolved   += 1
    }

    // Delete old incorrect WON history entries
    if (history?.length) {
      await supabase.from('score_history').delete().in('prediction_id', predIds).eq('result', 'WON')
      console.log(`  Deleted ${history.length} incorrect WON history entries`)
    }

    // Insert corrected LOST history entries
    await supabase.from('score_history').insert(newHistoryRows)
    console.log(`  Inserted ${newHistoryRows.length} corrected LOST history entries`)

    // Update predictions to LOST
    await supabase.from('predictions')
      .update({ status: 'LOST', resolved_at: new Date().toISOString(), score_contribution: null })
      .in('id', predIds)

    // Update profile with corrected scores
    await supabase.from('profiles').update({
      credit_score:     creditScore,
      visibility_score: visibilityScore,
      correct_streak:   correctStreak,
      wrong_streak:     wrongStreak,
      total_resolved:   totalResolved,
      total_correct:    totalCorrect,
      user_state:       'DECAYING',
    }).eq('id', userId)

    console.log(`\n  Final credit score:     ${creditScore.toFixed(2)}`)
    console.log(`  Final visibility score: ${visibilityScore.toFixed(2)}`)
  }

  console.log('\nDone.')
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
