# EPL Statistics Predictor

Predicts Premier League match statistics (goals, result probabilities, shots, shots on target, corners, cards) with
several competing models, measures every model on matches it had not seen, and publishes the comparison next to the
predictions. Built to run entirely on free tiers: GitHub (code and Actions), Supabase (Postgres) and Vercel (web).

The goal is not impressive numbers. It is a reproducible system that measures itself honestly. Where a model does
not beat a league-average baseline, the site says so.

- Web app: `epl/web` (Next.js, TypeScript), deployed as the Vercel project `epl-predictor`
- Machine learning: `epl/ml` (Python package `eplpred`)
- Database: `epl/supabase` (SQL migrations, three edge functions)
- Automation: `.github/workflows/epl-pipeline.yml`, `.github/workflows/epl-tests.yml`
- Docs: `epl/docs/` (architecture, data, methodology, limitations)

## Architecture

```
            GitHub Actions (epl-pipeline)                       Supabase (Postgres + RLS)
 football-data.co.uk ─┐                                    ┌──────────────────────────────┐
 fixturedownload.com ─┼─► download → validate → features → │ epl_matches                  │
                      │   tune → walk-forward backtest →   │ epl_predictions (insert-only)│
                      │   evaluate → select → predict      │ epl_model_evaluations        │
                      │         │                          │ epl_model_registry           │
                      │         └─ OIDC token ─► epl-writer│ epl_target_selection         │
                      │            (edge function, the only│ epl_demo_runs / _items       │
                      │             write path)            │ epl_data_source_audit        │
                      │                                    │ epl_pipeline_runs            │
                                                           └──────────────┬───────────────┘
                     Vercel (Next.js, epl-predictor)                      │ read-only anon key
   visitors ───────► fixtures · match pages · my picks ◄──────────────────┤
                     advanced: overview · evaluation · numbers · demo · history · data ◄─┘
                     picks → /api/picks → epl-picks edge function (epl_user_picks)
                     "Predict 3 Random Matches" → /api/demo → epl-demo edge function
```

Why this shape:

- **Training is batch work.** Vercel functions are short-lived and have no scientific Python, so models are trained
  and evaluated in GitHub Actions (free for public repositories) and the results are stored. Nothing is trained when
  someone opens a page.
- **No secrets in GitHub.** The pipeline proves who it is with a GitHub-signed OIDC token. The `epl-writer` edge
  function accepts only tokens from `Rinkino/Trust-Web`'s `epl-pipeline.yml` workflow and writes with the service-role
  key, which never leaves Supabase.
- **Public read, no public write.** Row Level Security allows `select` to everyone and nothing else. The demo button
  goes through the `epl-demo` edge function, which can only create demo runs.
- **Predictions are immutable.** A trigger rejects every update to `epl_predictions`; `created_at` is set by the
  database. Stored results in `epl_matches` cannot be rewritten either (trigger).

## Data

| Source | Use | Notes |
|---|---|---|
| football-data.co.uk `mmz4281/<season>/E0.csv` | Results and match statistics, 2000/01 onwards | Ground truth. Downloaded fresh each run; checksums recorded in `epl_data_source_audit`. Raw files are not committed because redistribution terms are not stated. |
| fixturedownload.com `feed/json/epl-<year>` | 2026/27 schedule (upcoming fixtures, UTC kick-offs) | Used only for fixtures and kick-off times. Its scores are cross-checked against football-data and never used as results. |

See `docs/data.md` for columns, validation rules and coverage.

## Models

| Name | Kind | What it is |
|---|---|---|
| `baseline` | Baseline | League averages of the 380 matches before the gameweek (home/away split), empirical H/D/A and threshold frequencies |
| `team_avg` | A | Mean of the home team's (exponentially weighted, shrunk) home "for" record and the away team's away "against" record |
| `poisson_strength` | B | Time-weighted, L2-penalised Poisson team-strength model (attack, defence, home advantage, promoted-team offset) per statistic; Dixon-Coles correction for goals; negative binomial where over-dispersed |
| `glm` | C | Regularised Poisson regression on engineered features (pooled home/away rows) |
| `hgb` | C | Histogram gradient boosting with Poisson loss on the same features |
| `logit_outcome`, `hgb_outcome` | C | Direct H/D/A classifiers |
| `market` | Reference | Average pre-closing bookmaker odds as probabilities. Evaluated for context only, never used to predict |

XGBoost was not added: scikit-learn's histogram gradient boosting is the same family, and the evaluation shows the
boosted model rarely beats the simpler ones, so a second boosting library would add complexity without evidence of
benefit.

## Evaluation (how accuracy is proven)

- **Walk-forward.** Before each weekly block (Monday–Sunday), every model is retrained on matches strictly before that
  Monday and predicts the block. Features use only matches on earlier dates (`features.py`), tested in
  `tests/test_features.py` and `tests/test_models_and_backtest.py`.
- **Three periods, never mixed:** hyper-parameters tuned on 2022/23; model per target chosen on 2023/24–2024/25;
  2025/26 held out and only reported. 2026/27 to date is a further out-of-sample period.
- **Same matches for every model.** Improvements are computed on identical match sets, with a paired bootstrap 95%
  interval.
- **Metrics.** Counts: MAE, RMSE, mean negative log-likelihood, 50%/80% interval coverage. Probabilities: log loss,
  Brier, calibration error and reliability bins. Result: multiclass log loss, Brier, accuracy, calibration.
- **Selection rule.** Starting from the simplest model, a more complex one is used only if it beats the current choice
  by more than 0.5% on validation. Targets where the chosen model's improvement over the baseline is not significant
  are flagged "weak" on the site.

Details in `docs/methodology.md`; known weaknesses in `docs/limitations.md`. Results of the first production run: `docs/report.md`.

## Running it

### Prerequisites

- Python 3.12, Node 22
- A Supabase project (free tier) and a Vercel account (free tier)

### Environment variables

`epl/ml/.env.example` and `epl/web/.env.example` list them. Only public values are needed outside Supabase:

| Variable | Where | Secret? |
|---|---|---|
| `EPL_SUPABASE_URL` | pipeline | no |
| `EPL_SUPABASE_ANON_KEY` | pipeline (reads) | no — RLS limits it to `select` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web | no |
| `SUPABASE_SERVICE_ROLE_KEY` | inside the edge functions only (set automatically by Supabase) | **yes — never put it anywhere else** |

### Supabase setup

1. Apply the migrations in `epl/supabase/migrations/` in order (SQL editor, or `supabase db push`).
2. Deploy the edge functions with JWT verification off (they authenticate callers themselves):
   ```
   supabase functions deploy epl-writer --no-verify-jwt
   supabase functions deploy epl-demo --no-verify-jwt
   ```
3. If you fork the repository, change `REPOSITORY` in `functions/epl-writer/index.ts` to your `owner/repo`.

### Local development

```bash
cd epl/ml
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
python -m pytest -q                                   # ~1 minute, offline

# Full pipeline without touching the database: writes JSONL + reports to ./out
python -m eplpred.pipeline --download --out out       # needs internet access to the two sources
python -m eplpred.pipeline --raw-dir path/to/raw --out out   # or from previously downloaded files
python -m eplpred.pipeline --download --out out --quick      # skip tuning (default configs)
```

Outside GitHub Actions the pipeline never writes to Supabase: without an OIDC token the writer saves
`out/<table>.jsonl` instead. Reports land in `out/` (`eval_validation.csv`, `eval_test.csv`, `selection.csv`,
`tuning.csv`, `summary.json`, `live.json`).

Web app:

```bash
cd epl/web
cp .env.example .env.local   # fill in the public URL and anon key
npm install
npm test                     # input validation, CSV escaping, actual-value definitions
npm run dev                  # http://localhost:3000
```

### GitHub Actions

- `epl-tests.yml` runs the Python tests on every push touching `epl/`.
- `epl-pipeline.yml` runs the full pipeline and writes to Supabase. Triggers:
  - manually: Actions → epl-pipeline → Run workflow (optionally "quick")
  - by committing a change to `epl/runs/pipeline.txt` (works on any branch)
  - daily at 05:17 UTC (GitHub only runs schedules on the default branch, so this starts once merged into `dev`)
- It needs `permissions: id-token: write` (already in the file) and nothing else; there are no repository secrets.
- A full run takes about 25 minutes on a standard runner (tuning is most of it); `--quick` takes about 12.
- Each run records its status, stage timings and errors in `epl_pipeline_runs`, shown on the Data status page. A
  failing run is marked `failed` with the error; it never silently leaves stale data marked as fresh.

### Vercel

Create a project from the repository with **Root Directory `epl/web`** and framework Next.js, and add the two
`NEXT_PUBLIC_*` variables. Pages render per request with data cached for five minutes, so builds do not need database
access.

## The site for visitors

The home page lists upcoming fixtures, each with its kickoff time, home/draw/away chances, most likely score and a
**View prediction** button. Everything else is one click deeper:

- **Match page** (`/match/<match_id>`): the model's prediction, a plain-English explanation, the visitor's own pick,
  and secondary numbers (shots, corners, cards). A figure taken from the league-average baseline is labelled as such,
  since it is the same for every match (e.g. both-teams-score, where no model beat the baseline in testing).
- **My picks** (`/my-picks`): the visitor's picks scored against final results, next to the model's record on the
  same matches.
- **Advanced statistics** (`/advanced` and the pages under it): backtests, the model comparison, the bookmaker
  reference, the three-match demo, historical accuracy and data quality.

**Explanations are computed, not written.** For the model that produces the result probabilities (currently the
Poisson GLM), each side's expected goals is an exact product: a baseline (an average side) times one factor per group
of inputs (attacking form, opponent's defending, results and Elo, venue, rest, ...). The pipeline stores these factors
and the raw inputs in `epl_prediction_explanations` (`eplpred/explain.py`; a test checks that the product reproduces
the model's number). The site turns them into sentences (`web/lib/explain.ts`) and invents nothing. Where no
explanation is stored for a prediction, the page says so.

**Picks.** Signing in is optional: visitors can sign in with Google (the same Supabase Auth as TrustWeb, so it is
one account for both) to keep their picks on any device. On sign-in, picks made earlier in that browser move into the
account. Without signing in, each browser generates a random 256-bit key and only its SHA-256 is stored with the
pick. All reads and writes go through `/api/picks` → the `epl-picks` edge function, which verifies the sign-in token itself. The `epl_user_picks` table has
no public access, and the database closes picks at kickoff (trigger `epl_user_picks_guard`) whatever the caller sends.
Each pick records the model prediction that was published at that moment. Scoring (view `epl_user_pick_scores`):
1 point for the right result, 2 more for the exact score. The model is scored the same way, using its most likely
result and the most likely scoreline that agrees with it.

## The three-match demonstration

Under Advanced statistics (`/advanced` or `/demo`), press **Predict 3 Random Matches**. The `epl-demo` edge function:

1. collects eligible fixtures: scheduled, kick-off in the future, with a stored pre-kickoff prediction;
2. draws a fresh 128-bit seed and takes the three eligible matches with the smallest `sha256(seed + match_id)`;
3. stores the run (seed, number of eligible matches, `sha256` of the sorted eligible ids) and the three prediction ids;
4. if fewer than three live fixtures exist, runs a clearly labelled **historical** demo on completed out-of-sample
   matches instead, and shows the actual results.

To audit a run, take its seed and the eligible list and run `eplpred.demo.verify_run(...)`; it must reproduce the same
three matches and hash. Every press creates a new run; nothing is overwritten.

Predictions are produced by the scheduled pipeline, not on click. Until new results arrive, a prediction made now
would use exactly the same data and model as the stored one, so the demo shows the stored prediction with its original
timestamp rather than pretending to compute a new one.

## Troubleshooting

- **Pipeline fails at "persist" with 401/403 from epl-writer** — the workflow lacks `id-token: write`, or the
  repository/workflow name differs from the one hard-coded in the edge function.
- **"completed result … is protected"** — the source changed a historical result. The pipeline skips such rows and logs
  them in `epl_data_source_audit`; correct deliberately with a migration that states the reason.
- **No upcoming fixtures** — international breaks and the off-season. The demo then falls back to historical mode.
- **Supabase project paused** (free tier, after a week without activity) — restore it from the dashboard; the daily
  pipeline run keeps it active once scheduled runs are enabled.

## Known limitations

See `docs/limitations.md`. In short: no lineups, injuries, referees or weather (no reliable free history); totals and
threshold probabilities barely beat, and on the 2025/26 test season sometimes trail, the league-average baseline; the
bookmaker market is better than every model at predicting the result; red cards carry very little signal.
