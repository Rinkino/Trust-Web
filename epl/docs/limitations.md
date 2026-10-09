# Limitations

Measured on the held-out 2025/26 season unless stated. The live numbers are on the Model evaluation page.

## What works

- Per-side counts (home or away goals, shots, shots on target, corners) are clearly better than the league-average
  baseline, typically 5–14% lower MAE, with bootstrap intervals that exclude zero.
- Match-result probabilities beat the baseline by about 5% in log loss and pick the right outcome about 49% of the time
  (baseline 43%).

## What does not work well

- **Totals and thresholds.** Total goals, total corners, total yellows and the over/under probabilities are no better
  than the baseline on 2025/26, and some selected models are slightly worse. These targets are marked "weak" on the
  site. The likely causes: the sum of two noisy per-side predictions inherits both errors, and league-level variation
  dominates match-level signal for totals.
- **Bookmaker comparison.** The average market probabilities are better than every model for the result (log loss
  about 1.015 vs 1.030). The models use only public results; the market also prices team news, lineups and money.
- **Red cards.** About one team in ten receives one; the models are near the base rate.
- **Prediction intervals are conservative.** 80% intervals contained the actual count 85–96% of the time, i.e. they are
  wider than necessary, partly because counts are discrete.
- **Away-shot bias in 2025/26.** Away shots were over-predicted by about 0.4 per match on average.

## Data limits

- No lineups, injuries, suspensions, referees or weather: no reliable, free historical source.
- Rest and congestion count Premier League matches only.
- xG is available only from 2026/27, too little to train on.
- The schedule comes from a third-party feed; a fixture moved at short notice is corrected on the next pipeline run.

## Engineering limits

- Predictions are produced by the scheduled pipeline, not on demand. The demo selects among stored pre-kickoff
  predictions; it does not recompute them on click (which would give the same numbers until new results arrive).
- Scheduled runs only start once the workflow is on the default branch (`dev`); until then runs are triggered manually
  or by committing to `epl/runs/pipeline.txt`.
- The Supabase free tier pauses a project after a week without activity. The daily run prevents this once scheduled.
- Free-tier limits apply (Vercel, Supabase, GitHub): a full run is ~25 minutes of Actions time (free for public repos) and
  stores about 25 MB per new model version.
