# Methodology

## Prediction targets

| Group | Count targets (expected value + 50%/80% interval) | Probability targets |
|---|---|---|
| Goals | home, away, total | H/D/A, over 1.5 / 2.5 / 3.5, both teams score |
| Shots | home, away, total shots; home, away, total shots on target | — |
| Corners | home, away, total | over 8.5 / 9.5 / 10.5 |
| Cards | home, away, total yellow cards | 4+ yellows, home red card, away red card |

Counts and probabilities are kept apart throughout: counts are scored with MAE, RMSE and log-likelihood; probabilities
with log loss, Brier score and calibration.

Every model outputs, per statistic, an expected count for each side and a dispersion parameter. Everything else is
derived from that predictive distribution (`eplpred/derive.py`):

- per-side distribution: Poisson, or negative binomial when the training residuals are over-dispersed (moment
  estimator of NB2 dispersion; values under 0.005 mean Poisson);
- totals: convolution of the two sides (assumes independence given the means);
- threshold probabilities: the upper tail of the total distribution;
- scorelines, result and both-teams-score: the joint goal distribution, with the Dixon-Coles low-score correction for
  the team-strength model;
- intervals: central quantiles of the predictive distribution. Because counts are discrete, coverage can exceed the
  nominal level; empirical coverage is reported.

Direct classifiers (`logit_outcome`, `hgb_outcome`) predict H/D/A probabilities only.

## Features (`eplpred/features.py`)

One chronological pass. For each calendar date, features for all matches on that date are computed from the current
team state; only then are that date's results added to the state. Consequences, each covered by a test:

- a match never sees its own statistics (`test_current_match_statistics_never_reach_its_features`);
- changing or deleting future matches does not change past features (`test_future_matches_never_change_past_features`);
- matches on the same day do not see each other (`test_same_day_matches_do_not_see_each_other`).

Per team and side:

- exponentially weighted averages (half-life 10 matches) of goals, shots, shots on target, corners, yellows, reds and
  fouls, for and against, over all venues and venue-specific, each shrunk toward the league mean with 4 pseudo-matches
  (so promoted and early-season teams start near the league average rather than at noise);
- rolling means over the last 3, 5 and 10 matches for the main statistics, and points per game;
- Elo rating (K=20, home advantage 60, goal-difference multiplier, 20% regression to the mean between seasons;
  promoted teams start at the average rating of the sides relegated the previous season);
- season-to-date points per game, goal difference per game and league position, from matches already played;
- rest days and matches in the previous 7/14 days (Premier League fixtures only, including published scheduled
  dates);
- promoted flag; trailing league environment (means of the last 380 matches) and empirical H/D/A rates.

Not used, because no reliable history exists for them in free data: lineups, injuries, suspensions, referees, weather.
Referee names and odds are stored but never used as features. xG exists only from 2026/27 and is not used.

## Models

See the README table. Training data: matches from 2003/04 (earlier seasons only warm up the features). The
team-strength model uses the last three years with time-decay weights.

## Evaluation protocol (`eplpred/backtest.py`, `eplpred/selection.py`, `eplpred/metrics.py`)

1. **Walk-forward.** Matches are grouped into weekly blocks (Monday to Sunday). Before each block every model is
   refitted on matches strictly before that Monday (`assert train.match_date.max() < cutoff`), then predicts the
   block. A test asserts no match is in the training set of its own prediction.
2. **Tuning** uses 2022/23 only: a small grid per model, scored by the mean of (metric / baseline metric) over the
   targets the model predicts. Where the best value sat at the edge of the first grid, the grid was widened, still on
   2022/23 only.
3. **Selection** uses 2023/24 and 2024/25. For each target, candidates are ordered from simplest
   (`baseline`, `team_avg`, `poisson_strength`, `glm`, `logit_outcome`, `hgb`, `hgb_outcome`) to most complex; a more
   complex model replaces the current choice only if its primary metric (MAE for counts, log loss for probabilities)
   is lower by more than 0.5%. A paired bootstrap (2,000 resamples) of the improvement over the baseline decides
   whether the target is flagged reliable.
4. **Test.** 2025/26 is predicted the same way and only reported. The selected-per-target composite ("selected") is
   built for 2025/26 and 2026/27 using the validation-period selection.
5. **Comparisons** between a model and the baseline always use the same matches. Improvement = 100 × (baseline − model)
   / baseline on the primary metric; negative values are shown as they are.

### A note on what was decided after seeing test results

The first full run showed that for targets flagged "weak" on validation (totals and most threshold probabilities), the
chosen model did not beat the baseline on 2025/26. A natural fix is to fall back to the baseline whenever the
validation improvement is not significant. That rule was **not** adopted in this version, because choosing it after
looking at the test season would quietly use the test data for model selection. It is listed as the first next
improvement; adopting it should be followed by evaluating on a season that was not used to motivate it (2026/27).

## Live predictions (`eplpred/predict.py`)

After evaluation, each selected model is refitted on all completed matches and predicts verified upcoming fixtures
kicking off within 21 days. Each fixture gets one `selected` prediction (best model per target, with attribution) and
one per contributing model. Rows are insert-only; `created_at` comes from the database clock; `generated_before_kickoff`
is a generated column. Fixtures further ahead are predicted by later runs, when their inputs are fresher.

## Model registry and promotion

Every run registers each model with its version (`code version + hash of its configuration`), configuration, tuning
results, training range and test metrics. Models serving at least one target are marked `production`. Because selection
is computed on fixed validation seasons, a new version can only change production when code or configuration changes,
and the evaluation run that produced it is stored alongside for comparison. Validation always covers two full seasons
(760 matches), above any reasonable minimum sample.
