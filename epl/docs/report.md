# Report — first production run (9 October 2026)

All numbers below come from pipeline run `20261009T010203Z-2f41032` (GitHub Actions run 37867705431, commit
`2f41032`), read back from the database. They are the same numbers the site shows.

## 1. What was built

| Component | Location |
|---|---|
| Ingestion, validation, team names, audit | `epl/ml/eplpred/fetch.py`, `ingest.py`, `teams.py`, `dataset.py` |
| Leakage-safe features | `epl/ml/eplpred/features.py` |
| Models: baseline, team averages, Poisson team strength, Poisson GLM, gradient boosting (counts and outcome), logistic outcome, market reference | `epl/ml/eplpred/models/` |
| Distributions, intervals and derived targets | `epl/ml/eplpred/distributions.py`, `derive.py` |
| Walk-forward backtest, metrics, tuning, selection | `epl/ml/eplpred/backtest.py`, `metrics.py`, `selection.py` |
| Live predictions, demo rule, uploads, orchestration | `epl/ml/eplpred/predict.py`, `demo.py`, `upload.py`, `pipeline.py` |
| Tests (49 + 1 network test) | `epl/ml/tests/` |
| Schema, RLS, triggers | `epl/supabase/migrations/` |
| Write path (OIDC) and demo runs | `epl/supabase/functions/epl-writer`, `epl-demo` |
| Web app (dashboard, evaluation, upcoming, demo, history, data status, CSV export) | `epl/web/` |
| Automation | `.github/workflows/epl-pipeline.yml`, `epl-tests.yml`, `epl-smoke.yml` |

## 2. Data

- **Sources:**
  - football-data.co.uk `E0.csv`: results and statistics, 2000/01 to 2026/27.
  - fixturedownload.com: the 2026/27 schedule.
  - Every download is recorded in `epl_data_source_audit` (URL, HTTP status, bytes, SHA-256).
- **Matches:** 9,930 completed (2000/01 to 2025/26 at 380 per season, plus 50 from 2026/27) and 330 scheduled. This
  run rejected 0 rows.
- **Missing statistics:**
  - Shots are missing on 2 matches, nulled because shots on target exceeded shots.
  - Corners and cards are missing on none.
  - Average odds are missing on 1,900 matches (all seasons before 2005/06).
  - xG is present only in 2026/27 and is not used.
- **Latest data:**
  - The newest result is Bournemouth 0–1 Liverpool (20 Sep 2026).
  - Sources were fetched at 01:02 UTC on 9 Oct 2026.
  - No scheduled fixture has a kick-off in the past, so no played match is missing.

## 3. Model comparison — held-out test season 2025/26 (380 matches)

The "selected" composite against the league-average baseline, on the same matches. Counts are scored by MAE (lower is
better); probabilities by log loss (lower is better). Improvement is 100 × (baseline − model) / baseline, so a
negative value means the model did worse.

| Target | Metric | Selected | Baseline | Improvement |
|---|---|---|---|---|
| shots_away | MAE | 3.276 | 3.686 | **+11.1%** |
| shots_home | MAE | 3.452 | 3.824 | **+9.7%** |
| sot_home | MAE | 1.726 | 1.861 | **+7.2%** |
| corners_home | MAE | 2.081 | 2.226 | **+6.5%** |
| goals_away | MAE | 0.838 | 0.893 | **+6.2%** |
| outcome (H/D/A) | log loss | 1.030 | 1.0875 | **+5.3%** (accuracy 49.2%) |
| goals_home | MAE | 0.951 | 0.998 | **+4.7%** |
| corners_away | MAE | 2.060 | 2.159 | **+4.6%** |
| sot_away | MAE | 1.600 | 1.672 | **+4.3%** |
| shots_total | MAE | 4.268 | 4.405 | +3.1% |
| yellows_home | MAE | 0.995 | 1.019 | +2.4% |
| sot_total | MAE | 2.280 | 2.322 | +1.8% |
| red_home | log loss | 0.1839 | 0.1843 | +0.2% |
| yellows_total | MAE | 1.580 | 1.581 | +0.1% |
| btts | log loss | 0.6889 | 0.6889 | 0.0% (baseline selected) |
| goals_over_3_5 | log loss | 0.6018 | 0.6018 | 0.0% (baseline selected) |
| yellows_at_least_4 | log loss | 0.6907 | 0.6908 | 0.0% |
| goals_over_1_5 | log loss | 0.5164 | 0.5157 | −0.1% |
| goals_over_2_5 | log loss | 0.6927 | 0.6901 | −0.4% |
| red_away | log loss | 0.2098 | 0.2084 | −0.7% |
| corners_over_10_5 | log loss | 0.6910 | 0.6865 | −0.7% |
| goals_total | MAE | 1.245 | 1.233 | −0.9% |
| corners_over_8_5 | log loss | 0.6507 | 0.6435 | −1.1% |
| corners_total | MAE | 2.666 | 2.633 | −1.2% |
| corners_over_9_5 | log loss | 0.6977 | 0.6865 | −1.6% |
| yellows_away | MAE | 1.051 | 1.022 | **−2.8%** |

- **Bookmaker reference** (average odds, evaluation only):
  - Outcome log loss 1.0153 (+6.6% vs baseline), better than the selected model's 1.030.
  - Over 2.5 goals log loss 0.6873 (+0.4%).
- **80% intervals:** they contained the actual count 85–96% of the time, so they are wider than needed.
- Per-model numbers for every target are on the Model evaluation page.

## 4. Evaluation validity

| Period | Seasons | Used for |
|---|---|---|
| Training history | from 2003/04 (2000–2003 only warms up features) | fitting |
| Tuning | 2022/23 | hyperparameters only |
| Validation | 2023/24 + 2024/25 (760 matches) | choosing the model per target |
| Test | 2025/26, 15 Aug 2025 – 24 May 2026, 380 matches | reporting only |
| Live | 2026/27 | out-of-sample predictions stored before kick-off |

**How leakage is prevented:**
- Every weekly block is predicted by models refitted only on matches before that block's Monday. The backtest asserts
  this on every refit.
- Features are computed per date before that date's results enter the state. Tests confirm that a match never sees
  its own statistics, that same-day matches don't see each other, and that changing future matches doesn't change
  past features.
- Odds and referees are never used as features.
- One rule was rejected after seeing test results ("fall back to the baseline when validation improvement isn't
  significant"). Adopting it would have used the test season for selection; it is documented as a next step instead.

## 5. Best model per target (selected on 2023/24–2024/25)

**Clear wins over the baseline** (bootstrap 95% interval above zero):

| Target | Model | Validation improvement | Bootstrap 95% CI |
|---|---|---|---|
| shots_home | glm | +17.4% | [13.2, 21.4] |
| shots_away | poisson_strength | +15.6% | [11.7, 19.4] |
| sot_away | poisson_strength | +12.0% | [8.9, 15.3] |
| outcome | glm | +11.1% | [8.5, 13.8] |
| sot_home | hgb | +10.9% | [7.3, 14.2] |
| goals_away | glm | +9.4% | [6.8, 12.2] |
| corners_home | poisson_strength | +9.3% | [6.2, 12.4] |
| goals_home | poisson_strength | +9.2% | [6.7, 11.8] |
| corners_away | glm | +7.7% | [4.8, 10.6] |
| yellows_away | glm | +4.1% | [1.7, 6.5] |
| shots_total | glm | +4.0% | [1.0, 6.9] |
| yellows_at_least_4 | glm | +2.4% | [0.1, 4.7] |
| sot_total | glm | +2.2% | [0.0, 4.2] |

**Not distinguishable from the baseline** (interval includes zero), marked "weak" on the site:
- goals_total, corners_total, yellows_total, yellows_home
- the over/under lines for goals and corners
- red cards

For btts and over 3.5 goals no model beat the baseline by more than 0.5%, so the baseline itself was selected.

The rule throughout: choose the simplest model unless a more complex one is better by more than 0.5% on validation. It
kept poisson_strength over glm for shots_away and corners_home, and glm over hgb for shots_home, sot_total and
yellows_total. Each reason is stored in `epl_target_selection` and shown on the site.

## 6. Three-match demonstration

Demo run `7f75c7d6-ae4b-4845-a163-a05110bca0ca`:
- Mode: live, drawing from 30 eligible fixtures.
- Seed: `52fe699250f64dc7b6c9b20e2fb09fc0`.
- Created by clicking through the deployed `/api/demo` from the smoke workflow.

All three predictions were stored at 2026-10-09 01:13:56 UTC with data up to 20 Sep 2026. Selection version
`1.0.0+ef1c50f0`; component models glm `1.0.0+0e94fe`, poisson_strength `1.0.0+830d32`, hgb `1.0.0+cc703a`, baseline
`1.0.0+44136f`.

| Fixture (kick-off UTC) | H / D / A | Goals (home–away, 80% interval) | Shots | Corners | Yellows | Over 2.5 |
|---|---|---|---|---|---|---|
| Brighton v Crystal Palace (18 Oct 13:00) | 63 / 21 / 17% | 1.81 [0–4] – 0.94 [0–2] | 16.8 – 9.8 | 5.6 – 3.8 | 1.6 – 2.2 | 56% |
| Chelsea v Tottenham (24 Oct 16:30) | 49 / 24 / 26% | 1.83 [0–4] – 1.14 [0–3] | 14.7 – 10.1 | 6.3 – 4.2 | 2.0 – 3.0 | 59% |
| Sunderland v Leeds (25 Oct 16:30) | 41 / 27 / 32% | 1.31 [0–3] – 1.16 [0–3] | 14.2 – 12.0 | 4.7 – 4.5 | 2.0 – 2.2 | 48% |

None of these matches has been played yet. After each one finishes, the History page will show how these predictions
compare with the result.

## 7. Limitations

- **Weak targets:**
  - Totals and over/under probabilities are no better than the baseline on 2025/26 (−0.1% to −1.6%).
  - yellows_away is worse on test (−2.8%) despite winning on validation.
  - Red cards are near the base rate.
- **Bookmaker comparison:** the market beats the model on match result (log loss 1.015 vs 1.030).
- **Unavailable data:** lineups, injuries, suspensions, referees as features, weather. xG covers too few matches to
  train on.
- **Sample size:** a 380-match test season gives roughly ±3 percentage points of uncertainty on improvement. Differences
  under about 2% are not meaningful.
- **Intervals** are conservative, as noted in section 3.
- **Not yet implemented:** scheduled daily runs only start once the workflow is on the default branch (`dev`).

More detail: `epl/docs/limitations.md`.

## 8. Deployment

- **Repository:** `Rinkino/Trust-Web`, branch `claude/resume-session-jrt3jx`, folder `epl/`.
- **App:** https://epl-predictor-psi.vercel.app (Vercel project `epl-predictor`, root `epl/web`, free tier).
- **Database:** Supabase project `vezcwptlyyeqsaybhegv`, tables `epl_*`.
  - Public read-only access through RLS.
  - Predictions are insert-only (trigger).
  - Completed results cannot be changed (trigger).
  - The service key exists only inside edge functions; GitHub holds no database secret.
- **Workflows:**
  - epl-pipeline run 3: success, about 14 minutes. Runs 1–2 failed before the token fix.
  - epl-tests: success.
  - epl-smoke: success, covering all six pages, the CSV export, invalid-input rejection and the demo end to end.
- **One stale record:** run `20261009T004355Z-b284d94` still says "running" because that job was killed. The next run
  marks it failed automatically, since it will be more than 90 minutes old.

## 9. How to rerun

- **From GitHub:**
  - Actions → `epl-pipeline` → Run workflow. Tick `quick` to skip tuning.
  - Or commit any change to `epl/runs/pipeline.txt`.
  - Once merged to `dev`, it also runs daily at 05:17 UTC.
- **Locally, offline** (writes JSONL files instead of the database):
  ```bash
  cd epl/ml && pip install -r requirements.txt
  python -m pytest -q
  python -m eplpred.pipeline --download --out out/ --jobs 4     # add --quick to skip tuning
  ```
- **Web:**
  ```bash
  cd epl/web && cp .env.example .env.local && npm install && npm run dev
  ```
- **Demo:** the button on `/demo`, or `curl -X POST <site>/api/demo -d '{"mode":"auto"}'`. Each run's page shows the
  seed and eligible-set hash; `eplpred/demo.py verify_run` re-derives the choice.

## 10. Next improvements (supported by the results above)

1. **Fall back to the baseline for "weak" targets.** Those are the totals, thresholds and red cards whose validation
   bootstrap interval included zero; this would have removed every negative row in section 3 except yellows_away. Since 2025/26 motivated
   the rule, judge it on 2026/27 only.
2. **Model totals jointly.** Totals lose to the baseline even where both sides win (shots, corners), which suggests
   correlated errors between the two sides. Predict the total directly, or model the correlation, instead of convolving
   two independent sides.
3. **Recalibrate interval widths.** Coverage is 85–96% where 80% is the target, so the dispersion estimate is too wide.
4. **Away yellows.** It won on validation but lost on test (−2.8%). A rolling stability check of the per-target choice
   over several seasons would catch choices that don't hold up.
5. **Market gap on match result (1.6% in log loss).** The likely cause is team news, which free data doesn't contain.
   No change is proposed until a free source exists.
