/**
 * Trust-Web Scoring Engine
 *
 * Credit Score — permanent track record (never resets, can go negative)
 * Visibility Score — momentum-based, streak driven
 */

export type ResolutionResult = 'WON' | 'LOST' | 'VOID'

export interface ScoringContext {
  currentCreditScore: number
  currentVisibilityScore: number
  totalResolved: number       // total non-void resolved predictions
  correctStreak: number       // consecutive correct 24hr windows
  wrongStreak: number         // consecutive wrong calls (resets on win)
  bestStreakEver: number
  daysInactive: number        // 24hr windows with no correct resolution and nothing pending
}

export interface ScoringResult {
  newCreditScore: number
  newVisibilityScore: number
  creditDelta: number
  visibilityDelta: number
  newCorrectStreak: number
  newWrongStreak: number
}

/**
 * Credibility weight — grows with track record
 * Starts low for new users, reaches 1.0 around 50 resolved predictions
 * Means veterans are punished harder for losses (they should know better)
 */
function credibilityWeight(totalResolved: number): number {
  return Math.min(1.0, Math.log10(totalResolved + 1) / Math.log10(51))
}

/**
 * Calculate score changes after a prediction resolves
 */
export function calculateScoreUpdate(
  result: ResolutionResult,
  odds: number,
  ctx: ScoringContext
): ScoringResult {
  const weight = credibilityWeight(ctx.totalResolved)

  if (result === 'VOID') {
    // Void: completely neutral, no streak impact
    return {
      newCreditScore: ctx.currentCreditScore,
      newVisibilityScore: ctx.currentVisibilityScore,
      creditDelta: 0,
      visibilityDelta: 0,
      newCorrectStreak: ctx.correctStreak,
      newWrongStreak: ctx.wrongStreak,
    }
  }

  if (result === 'WON') {
    const newCorrectStreak = ctx.correctStreak + 1
    const newWrongStreak = 0

    // Credit: odds value × exponential streak bonus
    const streakBonus = Math.pow(newCorrectStreak, 1.3) * 0.15
    const creditDelta = odds * (1 + streakBonus)

    // Visibility: streak drives visibility up sharply
    const visibilityDelta = odds * Math.pow(newCorrectStreak, 1.2) * 0.5

    return {
      newCreditScore: ctx.currentCreditScore + creditDelta,
      newVisibilityScore: ctx.currentVisibilityScore + visibilityDelta,
      creditDelta,
      visibilityDelta,
      newCorrectStreak,
      newWrongStreak,
    }
  }

  // LOST
  const newWrongStreak = ctx.wrongStreak + 1
  const newCorrectStreak = 0

  // Punishment:
  // - Scales inversely with odds (missing a sure thing hurts more)
  // - Multiplied by credibility weight (veterans punished harder)
  // - Grows exponentially with consecutive wrong calls
  const basePunishment = (1 / odds)
  const creditDelta = -(basePunishment * Math.max(0.3, weight) * Math.pow(newWrongStreak, 1.3))

  // Visibility drops on loss but less harshly than credit
  const visibilityDelta = -(basePunishment * Math.pow(newWrongStreak, 1.1) * 0.4)

  return {
    newCreditScore: ctx.currentCreditScore + creditDelta, // can go negative
    newVisibilityScore: Math.max(0, ctx.currentVisibilityScore + visibilityDelta),
    creditDelta,
    visibilityDelta,
    newCorrectStreak,
    newWrongStreak,
  }
}

/**
 * Apply inactivity decay to visibility score
 * Called when a user has no pending predictions and no correct resolution in 24hrs
 * Credit score is only affected by long-term inactivity (radioactive decay)
 */
export function applyInactivityDecay(ctx: ScoringContext): Partial<ScoringResult> {
  const historicalFloor = ctx.bestStreakEver * 0.05 // small permanent floor from history

  // Visibility decays gently each inactive window
  const visibilityDecay = ctx.currentVisibilityScore * 0.03 // 3% per inactive day
  const newVisibility = Math.max(historicalFloor, ctx.currentVisibilityScore - visibilityDecay)

  // Credit radioactive decay — only kicks in after 14 days inactive
  let newCredit = ctx.currentCreditScore
  if (ctx.daysInactive > 14) {
    const creditDecay = ctx.currentCreditScore * 0.01 // 1% per day after 14 days
    newCredit = ctx.currentCreditScore - creditDecay
  }

  return {
    newCreditScore: newCredit,
    newVisibilityScore: newVisibility,
  }
}

/**
 * Determine user state based on their activity
 */
export type UserState = 'ACTIVE' | 'PENDING' | 'DECAYING' | 'DORMANT'

export function getUserState(
  hasPendingPredictions: boolean,
  lastCorrectResolutionHoursAgo: number | null,
  daysInactive: number
): UserState {
  if (lastCorrectResolutionHoursAgo !== null && lastCorrectResolutionHoursAgo <= 24) {
    return 'ACTIVE'
  }
  if (hasPendingPredictions) {
    return 'PENDING'
  }
  if (daysInactive >= 7) {
    return 'DORMANT'
  }
  return 'DECAYING'
}
