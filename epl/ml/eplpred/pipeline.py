"""End-to-end pipeline: ingest -> features -> tune -> backtest -> evaluate -> select -> predict -> persist.

    python -m eplpred.pipeline --raw-dir ./raw --out ./out            # offline, files in ./out
    python -m eplpred.pipeline --download                             # in GitHub Actions (writes to Supabase)
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
import time
import traceback
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from . import CODE_VERSION
from .backtest import DEFAULT_CONFIG, FACTORIES, walk_forward
from .config import (COMPETITIONS, DEFAULT_COMPETITION, LIVE_SEASON, MODEL_ORDER, REFERENCE_MODELS, TARGET_BY_KEY, TARGETS, TEST_SEASONS, TRAIN_FROM,
                     TUNING_SEASONS, VALIDATION_SEASONS)
from .dataset import build_dataset, coverage_report
from .features import build_features
from .fetch import download_all, load_local
from .metrics import PRIMARY, evaluate
from .predict import composite, predict_live
from .selection import select, tune
from .upload import Writer, read_table

MATCH_COLUMNS = ["match_id", "season", "competition", "match_date", "kickoff_time", "kickoff_utc", "round", "home_team",
                 "away_team", "status", "fthg", "ftag", "ftr", "hthg", "htag", "hs", "as", "hst", "ast", "hc", "ac",
                 "hf", "af", "hy", "ay", "hr", "ar", "hxg", "axg", "referee", "odds_avg_h", "odds_avg_d", "odds_avg_a",
                 "odds_avg_over25", "odds_avg_under25", "source", "source_url", "source_row_hash"]
RESULT_FIELDS = ["fthg", "ftag", "hs", "as", "hst", "ast", "hc", "ac", "hy", "ay", "hr", "ar"]

METHODOLOGY = ("Chronological walk-forward: models refitted before every weekly block (Mon-Sun) on matches strictly "
               "before that Monday; features use only matches on earlier dates. Hyper-parameters tuned on {tune}; "
               "model per target selected on {val}; {test} held out and never used for any choice.")


def model_version(name: str, cfg: dict) -> str:
    h = hashlib.sha256(json.dumps(cfg, sort_keys=True).encode()).hexdigest()[:6]
    return f"{CODE_VERSION}+{h}"


def git_sha() -> str:
    sha = os.environ.get("GITHUB_SHA")
    if sha:
        return sha
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:
        return "unknown"


class Log:
    def __init__(self):
        self.t0 = time.perf_counter()

    def __call__(self, msg: str):
        print(f"[{time.perf_counter() - self.t0:7.1f}s] {msg}", flush=True)


def match_rows(ds, existing: dict[str, dict], now_iso: str) -> tuple[list[dict], list[dict]]:
    """Rows to upsert, plus conflicts. Completed results already stored are never
    overwritten: identical rows are skipped, differing ones are reported."""
    rows, conflicts = [], []
    m = ds.matches.copy()
    m["match_date"] = m.match_date.dt.date
    for r in m[MATCH_COLUMNS].to_dict("records"):
        r = {k: (None if (v is pd.NA or (isinstance(v, float) and np.isnan(v))) else v) for k, v in r.items()}
        for k in RESULT_FIELDS + ["hthg", "htag", "round"]:
            if r.get(k) is not None:
                r[k] = int(r[k])
        old = existing.get(r["match_id"])
        if old and old.get("status") == "completed":
            if r["status"] != "completed":
                continue  # schedule feed never downgrades a stored result
            diffs = [k for k in RESULT_FIELDS if old.get(k) != r.get(k)]
            if diffs:
                conflicts.append({"match_id": r["match_id"], "fields": diffs,
                                  "stored": {k: old.get(k) for k in diffs}, "incoming": {k: r.get(k) for k in diffs}})
                continue
            if old.get("source_row_hash") == r.get("source_row_hash"):
                continue
        elif old and old.get("status") == r["status"] == "scheduled" and old.get("kickoff_utc") and r.get("kickoff_utc"):
            if pd.Timestamp(old["kickoff_utc"]) == pd.Timestamp(r["kickoff_utc"]) and old.get("round") == r.get("round"):
                continue
        r["last_ingested_at"] = now_iso
        rows.append(r)
    return rows, conflicts


def eval_rows(ev: pd.DataFrame, run_key: str, split: str, season: str, versions: dict, methodology: str,
              competition: str = "EPL") -> list[dict]:
    out = []
    for r in ev.to_dict("records"):
        out.append({
            "competition": competition, "run_key": run_key, "model_name": r["model"], "model_version": versions[r["model"]],
            "target": r["target"], "target_kind": r["kind"], "split": split, "season": season,
            "eval_start": r["eval_start"], "eval_end": r["eval_end"], "n_matches": int(r["n"]),
            "methodology": methodology,
            "mae": r.get("mae"), "rmse": r.get("rmse"), "mean_nll": r.get("mean_nll"),
            "log_loss": r.get("log_loss"), "brier": r.get("brier"), "accuracy": r.get("accuracy"), "ece": r.get("ece"),
            "coverage_50": r.get("coverage_50"), "coverage_80": r.get("coverage_80"),
            "baseline_model": "baseline", "baseline_metric": r.get("baseline_metric"),
            "improvement_pct": r.get("improvement_pct"),
            "calibration": {"bins": r.get("calibration"), "improvement_ci": r.get("improvement_ci"),
                            "bias": r.get("bias"), "base_rate": r.get("base_rate"), "mean_p": r.get("mean_p"),
                            "freq": r.get("freq")},
        })
    return out


# A run still marked running after this long was killed by the job timeout (150 minutes).
STALE_AFTER_MINUTES = 180


def run(args) -> int:
    log = Log()
    started = datetime.now(timezone.utc)
    sha = git_sha()
    comps = args.competitions
    run_key = started.strftime("%Y%m%dT%H%M%SZ") + "-" + sha[:7]
    if comps:  # parallel jobs, one per league group, each record their own run
        run_key += "-" + "-".join(comps).lower()
    writer = Writer(outdir=args.out)
    stages: dict[str, dict] = {}
    summary: dict = {"code_version": CODE_VERSION, "remote": writer.remote}
    workflow_url = None
    if os.environ.get("GITHUB_RUN_ID"):
        workflow_url = f"{os.environ.get('GITHUB_SERVER_URL')}/{os.environ.get('GITHUB_REPOSITORY')}/actions/runs/{os.environ['GITHUB_RUN_ID']}"

    def status(state: str, error: str | None = None):
        writer.write("epl_pipeline_runs", [{"run_key": run_key, "started_at": started, "status": state,
                                            "finished_at": None if state == "running" else datetime.now(timezone.utc),
                                            "stages": stages, "summary": summary, "git_sha": sha,
                                            "workflow_url": workflow_url, "error": error}])

    def stage(name, fn):
        t = time.perf_counter()
        log(f"stage {name} ...")
        out = fn()
        stages[name] = {"seconds": round(time.perf_counter() - t, 1), "ok": True}
        status("running")
        return out

    status("running")
    try:
        # A job killed by its timeout cannot report; mark such runs as failed.
        if writer.remote:
            stale = [r for r in read_table("epl_pipeline_runs", "run_key,started_at,stages,summary,git_sha,workflow_url",
                                           {"status": "eq.running"})
                     if r["run_key"] != run_key and pd.Timestamp(r["started_at"]) < pd.Timestamp(started) - pd.Timedelta(minutes=STALE_AFTER_MINUTES)]
            if stale:
                writer.write("epl_pipeline_runs", [{**r, "status": "failed", "finished_at": None,
                                                    "error": "abandoned: the job ended without reporting (timeout or crash)"}
                                                   for r in stale])
        # 1. Ingest
        files = stage("download", lambda: download_all(competitions=comps) if args.download
                      else load_local(args.raw_dir, competitions=comps))
        ds = stage("validate", lambda: build_dataset(files))
        now_iso = datetime.now(timezone.utc).isoformat()
        existing = {}
        if writer.remote:
            existing = {r["match_id"]: r for r in read_table("epl_matches", "match_id,status,source_row_hash,kickoff_utc,round," + ",".join(RESULT_FIELDS))}
        mrows, conflicts = match_rows(ds, existing, now_iso)
        stage("persist_matches", lambda: writer.write("epl_matches", mrows))
        audit = []
        for a in ds.audit:
            audit.append({**a, "pipeline_run": run_key})
        if conflicts:
            audit.append({"pipeline_run": run_key, "source": "pipeline", "source_url": "epl_matches",
                          "retrieved_at": now_iso, "records_retrieved": len(conflicts), "records_accepted": 0, "records_rejected": len(conflicts),
                          "validation_errors": [{"conflict": c} for c in conflicts]})
        if ds.merge and (ds.merge.conflicts or ds.merge.unverified_results):
            audit.append({"pipeline_run": run_key, "source": "cross-check", "source_url": "results vs schedule",
                          "retrieved_at": now_iso, "records_retrieved": ds.merge.completed,
                          "records_accepted": ds.merge.completed - len(ds.merge.conflicts),
                          "records_rejected": len(ds.merge.conflicts),
                          "validation_errors": [{"conflict": c} for c in ds.merge.conflicts] +
                                               [{"unverified_result": u} for u in ds.merge.unverified_results]})
        writer.write("epl_data_source_audit", audit)
        cov = coverage_report(ds)
        summary["data"] = {"completed": int((ds.matches.status == "completed").sum()),
                           "scheduled": int((ds.matches.status == "scheduled").sum()),
                           "seasons": sorted(ds.matches.season.unique().tolist()),
                           "last_result_date": str(ds.completed.match_date.max().date()),
                           "match_rows_written": len(mrows), "result_conflicts": len(conflicts),
                           "coverage": json.loads(cov.to_json(orient="index"))}
        log(f"data: {summary['data']['completed']} completed, {summary['data']['scheduled']} scheduled, "
            f"{len(mrows)} rows written, {len(conflicts)} conflicts")

        # 2. Features: each competition built separately, linked by promotion and relegation
        feats = stage("features", lambda: build_features(ds.matches))
        all_data = ds.matches.set_index("match_id").join(feats)

        # Bookmaker odds for every competition (insert-only history)
        odds_rows = odds_table_rows(ds, writer)
        stage("persist_odds", lambda: writer.write("epl_match_odds", odds_rows))
        summary["odds_rows_written"] = len(odds_rows)

        summary["competitions"] = {}
        for comp in [c for c in COMPETITIONS if (all_data.competition == c).any()]:
            data = all_data[all_data.competition == comp]
            cs: dict = {}
            summary["competitions"][comp] = cs
            log(f"=== {comp}: {int((data.status == 'completed').sum())} completed, {int((data.status == 'scheduled').sum())} scheduled")
            # 3. Tune on the earliest evaluation season only
            if args.quick:
                configs = dict(DEFAULT_CONFIG)
                tuning = pd.DataFrame()
            else:
                configs, tuning = stage(f"{comp}:tune", lambda: tune(data, TUNING_SEASONS, n_jobs=args.jobs, log=log))
            cs["configs"] = configs
            versions = {m: model_version(m, configs[m]) for m in configs}

            # 4. Walk-forward on validation, test and the live season to date
            eval_seasons = VALIDATION_SEASONS + TEST_SEASONS + [LIVE_SEASON]
            bt = stage(f"{comp}:backtest", lambda: walk_forward(data, eval_seasons, configs, n_jobs=args.jobs, progress=True))
            fr = bt.frame()
            all_models = [m for m in MODEL_ORDER + REFERENCE_MODELS if m in configs]
            val = fr[fr.season.isin(VALIDATION_SEASONS)]
            test_main = fr[fr.season.isin(TEST_SEASONS)]
            ev_val = evaluate(val, all_models)
            sel = select(ev_val, val)
            selection = dict(zip(sel.target, sel.selected))
            sel_hash = hashlib.sha256(json.dumps({"sel": selection, "cfg": configs, "competition": comp}, sort_keys=True).encode()).hexdigest()[:8]
            selection_version = f"{CODE_VERSION}+{sel_hash}"
            cs["selection_version"] = selection_version
            cs["selection"] = selection

            # Composite ('selected') predictions for every out-of-sample match
            comp_rows = []
            oos = fr[fr.season.isin(TEST_SEASONS + [LIVE_SEASON])]
            from .derive import actual_values, score_row  # noqa: E402  (scores of the composite)
            for mid, g in oos.groupby("match_id"):
                vbm = dict(zip(g.model, g["values"]))
                values, used = composite(vbm, selection)
                first = g.iloc[0]
                scores = {}
                for t, mname in used.items():
                    if t in TARGET_BY_KEY:
                        s = g[g.model == mname].iloc[0]["scores"].get(t)
                        if s is not None:
                            scores[t] = s
                comp_rows.append({"match_id": mid, "season": first.season, "match_date": first.match_date,
                                  "home_team": first.home_team, "away_team": first.away_team, "model": "selected",
                                  "cutoff": first.cutoff, "train_last_date": first.train_last_date, "values": values,
                                  "scores": scores, "target_models": used})
            composite_df = pd.DataFrame(comp_rows)
            fr_all = pd.concat([fr, composite_df], ignore_index=True)
            versions["selected"] = selection_version

            methodology = METHODOLOGY.format(tune=", ".join(TUNING_SEASONS), val=", ".join(VALIDATION_SEASONS),
                                             test=", ".join(TEST_SEASONS))
            ev_rows = eval_rows(ev_val, run_key, "validation", "ALL", versions, methodology, comp)
            for s in VALIDATION_SEASONS:
                ev_rows += eval_rows(evaluate(val[val.season == s], all_models), run_key, "validation", s, versions, methodology, comp)
            test_models = all_models + ["selected"]
            ev_test = evaluate(fr_all[fr_all.season.isin(TEST_SEASONS)], test_models)
            ev_rows += eval_rows(ev_test, run_key, "test", "ALL", versions, methodology, comp)
            for s in TEST_SEASONS + [LIVE_SEASON]:
                e = evaluate(fr_all[fr_all.season == s], test_models)
                if not e.empty:
                    ev_rows += eval_rows(e, run_key, "test", s, versions, methodology, comp)
            stage(f"{comp}:persist_evaluations", lambda: writer.write("epl_model_evaluations", ev_rows))

            # 5. Selection + registry
            sel_rows = []
            for r in sel.to_dict("records"):
                sel_rows.append({"competition": comp, "selection_version": selection_version, "target": r["target"], "target_kind": r["kind"],
                                 "selected_model": r["selected"], "selected_version": versions[r["selected"]],
                                 "primary_metric": r["primary_metric"], "selection_period": ", ".join(VALIDATION_SEASONS),
                                 "reason": r["reason"], "reliable": r["reliable"],
                                 "metrics": {"metric": r["metric"], "baseline_metric": r["baseline_metric"],
                                             "improvement_pct": r["improvement_pct"], "improvement_ci": r["improvement_ci"],
                                             "candidates": r["candidates"], "best_raw": r["best_raw"]}})
            writer.write("epl_target_selection", sel_rows)

            # 6. Live predictions
            live, live_info = stage(f"{comp}:predict_live", lambda: predict_live(data, configs, selection))
            cs["live"] = live_info
            cutoff_ts = live_info.get("now")
            last_result = pd.Timestamp(data[data.status == "completed"].match_date.max()).tz_localize("UTC") + pd.Timedelta(hours=23, minutes=59)

            registry = []
            for m in all_models:
                cls = FACTORIES[m]
                used_for = [t for t, mm in selection.items() if mm == m]
                tm = ev_test[(ev_test.model == m)]
                registry.append({
                    "competition": comp, "model_name": m, "model_version": versions[m], "algorithm": getattr(cls, "algorithm", m),
                    "description": (cls.__doc__ or "").strip().split("\n\n")[0],
                    "feature_set": _feature_set(m), "config": {"params": configs.get(m, {}), "train_from": TRAIN_FROM,
                                                             "tuning": json.loads(tuning[tuning.model == m].to_json(orient="records")) if len(tuning) else []},
                    "training_cutoff": str(last_result.date()), "training_start": TRAIN_FROM,
                    "training_end": str(data[data.status == "completed"].match_date.max().date()),
                    "metrics": {"targets_selected": used_for,
                                "test": {r.target: r._asdict().get(PRIMARY[r.kind]) for r in tm.itertuples()}},
                    "artifact_location": f"retrained each run from config; code {CODE_VERSION} @ {sha[:7]}",
                    "status": "production" if used_for else ("retired" if m in REFERENCE_MODELS else "candidate"),
                })
            writer.write("epl_model_registry", registry)

            # 7. Predictions
            pred_rows = []
            for p in live:
                pred_rows.append({"competition": comp, "mode": "live", "match_id": p["match_id"], "home_team": p["home_team"],
                                  "away_team": p["away_team"], "kickoff_utc": p["kickoff_utc"],
                                  "match_date": p["match_date"], "model_name": "selected",
                                  "model_version": selection_version, "selection_version": selection_version,
                                  "data_cutoff": last_result, "values": p["values"],
                                  "target_models": {**p["target_models"], "_versions": {m: versions[m] for m in set(p["target_models"].values())}},
                                  "pipeline_run": run_key})
                for mname, vals in p["per_model"].items():
                    pred_rows.append({"competition": comp, "mode": "live", "match_id": p["match_id"], "home_team": p["home_team"],
                                      "away_team": p["away_team"], "kickoff_utc": p["kickoff_utc"],
                                      "match_date": p["match_date"], "model_name": mname, "model_version": versions[mname],
                                      "selection_version": selection_version, "data_cutoff": last_result, "values": vals,
                                      "target_models": None, "pipeline_run": run_key})
            stage(f"{comp}:persist_live", lambda: writer.write("epl_predictions", pred_rows))
            expl_rows = [{"pipeline_run": run_key, "match_id": p["match_id"], "model_name": p["explanation"]["model_name"],
                          "model_version": versions[p["explanation"]["model_name"]], "explanation": p["explanation"]}
                         for p in live if p.get("explanation")]
            stage(f"{comp}:persist_explanations", lambda: writer.write("epl_prediction_explanations", expl_rows))
            cs["live_predictions"] = len(live)

            # Backtest predictions are stored once per model version (they are deterministic).
            bt_rows = []
            for name in all_models + ["selected"]:
                ver = versions[name]
                if writer.remote and read_table("epl_predictions", "prediction_id",
                                                {"competition": f"eq.{comp}", "mode": "eq.backtest", "model_name": f"eq.{name}", "model_version": f"eq.{ver}",
                                                 "limit": "1"}):
                    continue
                for r in fr_all[fr_all.model == name].to_dict("records"):
                    bt_rows.append({"competition": comp, "mode": "backtest", "match_id": r["match_id"], "home_team": r["home_team"],
                                    "away_team": r["away_team"], "kickoff_utc": None, "match_date": r["match_date"],
                                    "model_name": name, "model_version": ver, "selection_version": selection_version,
                                    "data_cutoff": pd.Timestamp(r["train_last_date"]).tz_localize("UTC") + pd.Timedelta(hours=23, minutes=59),
                                    "values": r["values"], "target_models": r.get("target_models") if name == "selected" else None,
                                    "pipeline_run": run_key})
            stage(f"{comp}:persist_backtest", lambda: writer.write("epl_predictions", bt_rows))
            cs["backtest_predictions_written"] = len(bt_rows)

            # 8. Betting evaluation against bookmaker odds (reads predictions, changes none)
            value_rows = stage(f"{comp}:value_backtest", lambda: value_rows_for(fr_all, ds, selection, versions, run_key, methodology, comp))
            cs["value_checks"] = comparability(value_rows)
            stage(f"{comp}:persist_value", lambda: writer.write("epl_value_backtest", value_rows))
            cs["value_backtest_rows"] = len(value_rows)
            cs["timings"] = {k: round(v, 1) for k, v in bt.timings.items()}
            cs["headline"] = _headline(ev_test, sel)
            if args.out:
                _local_report(os.path.join(args.out, comp), ev_val, ev_test, sel, tuning, cs, fr_all, live)
        # The Premier League's summary also stays at the top level, where existing pages read it.
        summary.update({k: v for k, v in summary["competitions"].get(DEFAULT_COMPETITION, {}).items()})
        status("succeeded")
        log("done")
        return 0
    except Exception as e:  # record the failure, then fail the job
        stages["error"] = {"ok": False}
        status("failed", f"{e}\n{traceback.format_exc()[-3000:]}")
        raise


def odds_table_rows(ds, writer) -> list[dict]:
    """One row per completed match with stored odds; rows already stored unchanged are skipped."""
    m = ds.matches
    rows = []
    if "odds" not in m.columns:
        return rows
    for r in m[m.status == "completed"][["match_id", "season", "match_date", "odds", "source_url"]].to_dict("records"):
        odds = r.get("odds")
        if not isinstance(odds, dict) or not odds:
            continue
        h = hashlib.sha256(json.dumps(odds, sort_keys=True).encode()).hexdigest()[:16]
        rows.append({"match_id": r["match_id"], "season": r["season"], "match_date": pd.Timestamp(r["match_date"]).date(),
                     "odds": odds, "odds_hash": h, "source": "football-data.co.uk", "source_url": r["source_url"],
                     "collection_note": ODDS_COLLECTION_NOTE})
    if writer.remote and rows:
        have = {(x["match_id"], x["odds_hash"]) for x in read_table("epl_match_odds", "match_id,odds_hash")}
        rows = [r for r in rows if (r["match_id"], r["odds_hash"]) not in have]
    return rows


ODDS_COLLECTION_NOTE = ("football-data.co.uk: pre-closing odds collected Friday afternoon for weekend games and Tuesday "
                        "afternoon for midweek games; closing odds are the last available before kickoff. No per-quote "
                        "timestamps. Average and best are across the bookmakers football-data tracks.")


def value_rows_for(fr_all, ds, selection, versions, run_key, methodology, competition: str = "EPL") -> list[dict]:
    from .value import MARKETS, evaluate as value_evaluate

    existing = {market: selection.get(target) for market, (_, target) in MARKETS.items()}
    models = {"baseline": "baseline", "market": "market"}
    for name in set(existing.values()):
        if name and name not in models:
            models[name] = name
    periods = {"validation": VALIDATION_SEASONS, "test": TEST_SEASONS, "live": [LIVE_SEASON]}
    out = []
    for r in value_evaluate(fr_all[fr_all.model != "selected"], ds.matches, models, periods):
        name = r["model_name"]
        role = ("market" if name == "market" else "existing_model" if existing.get(r["market"]) == name
                else "baseline" if name == "baseline" else "other")
        out.append({**{k: v for k, v in r.items() if k != "label"}, "competition": competition, "run_key": run_key, "role": role,
                    "model_version": "odds" if name == "market" else versions.get(name),
                    "methodology": "Flat 1-unit stakes on every selection passing the strategy's filters, at the "
                                   "pre-closing price of the price source. Probabilities from the walk-forward "
                                   "backtest (" + methodology + ") Strategies fixed in advance, none tuned."})
    return out


def comparability(rows: list[dict]) -> dict:
    """The three sources of probabilities must be scored on identical matches. Returns the
    (split, season, market, price source) cells where they are not, which should be none."""
    cells: dict[tuple, set] = {}
    for r in rows:
        key = (r["split"], r["season"], r["market"], r["price_source"])
        cells.setdefault(key, set()).add((r["eligible_matches"], r["period_start"], r["period_end"]))
    bad = [list(k) for k, v in cells.items() if len(v) > 1]
    return {"cells": len(cells), "mismatched": bad}


def _feature_set(model: str) -> list[str]:
    from .models.ml import OUTCOME_FEATURES, count_features
    if model in ("glm", "hgb"):
        return sorted({c for s in ("goals", "shots", "sot", "corners", "yellows", "reds") for c in count_features(s)})
    if model in ("logit_outcome", "hgb_outcome"):
        return OUTCOME_FEATURES
    if model == "team_avg":
        return ["{h,a}_{stat}_{for,ag}_venue (EWMA, half-life 10 matches, shrunk to league mean)"]
    if model == "poisson_strength":
        return ["team identity (attack/defence)", "home advantage", "promoted flag", "time-decay weights"]
    if model == "baseline":
        return ["league averages of the previous 380 matches"]
    return ["average pre-closing odds"]


def _headline(ev_test: pd.DataFrame, sel: pd.DataFrame) -> list[dict]:
    out = []
    for t in TARGETS:
        e = ev_test[ev_test.target == t.key].set_index("model")
        if e.empty or "baseline" not in e.index:
            continue
        pm = PRIMARY[t.kind]
        row = {"target": t.key, "metric": pm, "baseline": float(e.loc["baseline", pm]), "n": int(e.loc["baseline", "n"])}
        for m in e.index:
            row[m] = float(e.loc[m, pm])
        out.append(row)
    return out


def _local_report(outdir: str, ev_val, ev_test, sel, tuning, summary, fr_all, live) -> None:
    os.makedirs(outdir, exist_ok=True)
    ev_val.to_csv(os.path.join(outdir, "eval_validation.csv"), index=False)
    ev_test.to_csv(os.path.join(outdir, "eval_test.csv"), index=False)
    sel.to_csv(os.path.join(outdir, "selection.csv"), index=False)
    if len(tuning):
        tuning.to_csv(os.path.join(outdir, "tuning.csv"), index=False)
    with open(os.path.join(outdir, "summary.json"), "w") as f:
        json.dump(summary, f, indent=1, default=str)
    fr_all.drop(columns=["mu", "alpha"], errors="ignore").to_pickle(os.path.join(outdir, "backtest.pkl"))
    with open(os.path.join(outdir, "live.json"), "w") as f:
        json.dump(live, f, indent=1, default=str)


def check_names(args) -> int:
    """Download and validate only, then list every team name no source could map.
    Writes nothing anywhere: used when adding a league, before its first real run."""
    files = download_all(competitions=args.competitions) if args.download else load_local(args.raw_dir, competitions=args.competitions)
    ds = build_dataset(files)
    unknown: dict[str, dict[str, int]] = {}
    other: dict[str, int] = {}
    for a in ds.audit:
        for e in a.get("validation_errors", []):
            reason = e.get("reason")
            if not reason:
                continue
            if reason.startswith("unknown team name"):
                name = reason.split(":", 1)[1].strip()
                unknown.setdefault(a["source"], {}).setdefault(name, 0)
                unknown[a["source"]][name] += 1
            else:
                other[f"{a['source']}: {reason}"] = other.get(f"{a['source']}: {reason}", 0) + 1
    lines = ["# Team-name check", ""]
    for src, names in sorted(unknown.items()):
        lines.append(f"## {src}: {len(names)} unknown")
        lines += [f"- {n} ({k} rows)" for n, k in sorted(names.items())]
    if not unknown:
        lines.append("Every team name is recognised.")
    if other:
        lines += ["", "## Other rejections"] + [f"- {r} ({k})" for r, k in sorted(other.items())[:100]]
    counts = ds.matches.groupby(["competition", "status"]).size().to_dict()
    lines += ["", "## Accepted matches"] + [f"- {c} {st}: {n}" for (c, st), n in sorted(counts.items())]
    text = "\n".join(lines)
    print(text)
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a") as f:
            f.write(text + "\n")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--download", action="store_true", help="download sources (default: read --raw-dir)")
    ap.add_argument("--raw-dir", default="raw")
    ap.add_argument("--out", default=None, help="local output directory (reports; JSONL when not uploading)")
    ap.add_argument("--jobs", type=int, default=os.cpu_count() or 1)
    ap.add_argument("--quick", action="store_true", help="skip tuning (default configs)")
    ap.add_argument("--competitions", type=lambda v: [c.strip() for c in v.split(",") if c.strip()] or None, default=None,
                    help="comma-separated competition codes to run (default: all)")
    ap.add_argument("--check-names", action="store_true", help="only list unrecognised team names; writes nothing")
    args = ap.parse_args(argv)
    for c in args.competitions or []:
        if c not in COMPETITIONS:
            ap.error(f"unknown competition {c!r}; known: {', '.join(COMPETITIONS)}")
    return check_names(args) if args.check_names else run(args)


if __name__ == "__main__":
    sys.exit(main())
