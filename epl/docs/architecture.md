# Architecture

## Components

| Path | Role |
|---|---|
| `epl/ml/eplpred/fetch.py` | Download sources (or read a local directory) |
| `epl/ml/eplpred/ingest.py`, `teams.py`, `dataset.py` | Parse, validate, normalise, merge, audit |
| `epl/ml/eplpred/features.py` | Leakage-safe chronological features |
| `epl/ml/eplpred/models/` | `simple.py` (baseline, team averages, market reference), `strength.py` (Poisson team strength), `ml.py` (GLM, gradient boosting, classifiers) |
| `epl/ml/eplpred/distributions.py`, `derive.py` | Predictive distributions → every target; per-match scoring |
| `epl/ml/eplpred/backtest.py` | Weekly walk-forward, parallel over blocks |
| `epl/ml/eplpred/metrics.py`, `selection.py` | Metrics, bootstrap, tuning, per-target selection |
| `epl/ml/eplpred/predict.py` | Composite predictions, eligible fixtures, live predictions |
| `epl/ml/eplpred/demo.py` | The demo selection rule (Python mirror for audits) |
| `epl/ml/eplpred/upload.py` | Batched writes via `epl-writer` (OIDC), public reads |
| `epl/ml/eplpred/pipeline.py` | Orchestration and run status |
| `epl/supabase/migrations/` | Schema, RLS, triggers, results view |
| `epl/supabase/functions/epl-writer` | The only write path for pipeline data |
| `epl/supabase/functions/epl-demo` | Creates auditable demo runs |
| `epl/web/` | Next.js app (server components; data cached 5 minutes) |

## Trust boundaries

1. **GitHub Actions → Supabase.** The job requests an OIDC token with audience `epl-writer`. The edge function verifies
   the signature against GitHub's JWKS and checks `repository` and `job_workflow_ref` (only `epl-pipeline.yml` in
   `Rinkino/Trust-Web`), and rejects pull-request events. It writes only to a fixed list of tables, and predictions
   only by insert.
2. **Visitors → Supabase.** The anon key is public; RLS allows `select` on `epl_*` and nothing else. The results view
   uses `security_invoker` so it inherits those rules.
3. **Visitors → demo.** `/api/demo` validates the body and forwards to `epl-demo`, which uses the service role but can
   only insert demo runs referencing existing predictions, and is rate-limited (3 runs per 10 seconds).

## Why not ...

- **A Python API on Vercel?** Training needs scikit-learn and minutes of CPU; Vercel functions are short-lived and the
  free tier is not meant for it. Batch in Actions, serve stored results.
- **GitHub secrets for the database?** Not needed: OIDC proves the caller's identity, so there is nothing to leak.
- **A separate Supabase project?** The free plan's two active projects were in use, so the `epl_` tables live in the
  existing project, isolated by prefix and policies.
