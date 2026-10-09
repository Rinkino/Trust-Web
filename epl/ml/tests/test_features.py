import numpy as np
import pandas as pd

from eplpred.features import build_features, pooled


def test_rolling_means_use_only_earlier_matches(league):
    f = build_features(league)
    s = league[league.season == "2020-21"]
    team = "Arsenal"
    games = league[(league.home_team == team) | (league.away_team == team)].sort_values("match_date")
    target = s[(s.home_team == team)].iloc[4]
    prev = games[games.match_date < target.match_date].tail(3)
    gf = [r.fthg if r.home_team == team else r.ftag for r in prev.itertuples()]
    assert np.isclose(f.loc[target.match_id, "h_goals_for_l3"], np.mean(gf))


def test_current_match_statistics_never_reach_its_features(league):
    base = build_features(league)
    mid = league[league.season == "2021-22"].match_id.iloc[10]
    altered = league.copy()
    i = altered.index[altered.match_id == mid][0]
    for c in ["fthg", "ftag", "hs", "as", "hc", "ac", "hy", "ay"]:
        altered.loc[i, c] = altered.loc[i, c] + 7
    f2 = build_features(altered)
    pd.testing.assert_series_equal(base.loc[mid], f2.loc[mid], check_names=False)


def test_future_matches_never_change_past_features(league):
    base = build_features(league)
    cut = league[league.season == "2022-23"].match_date.iloc[15]
    earlier = league[league.match_date < cut].match_id
    altered = league.copy()
    fut = altered.match_date >= cut
    altered.loc[fut, "fthg"] = 9
    altered.loc[fut, "hs"] = 40
    f2 = build_features(altered)
    pd.testing.assert_frame_equal(base.loc[earlier], f2.loc[earlier])
    # Truncating the future entirely gives the same features too.
    f3 = build_features(league[league.match_date < cut])
    pd.testing.assert_frame_equal(base.loc[earlier], f3.loc[earlier])


def test_same_day_matches_do_not_see_each_other(league):
    base = build_features(league)
    day = league[league.season == "2021-22"].match_date.iloc[20]
    same = league[league.match_date == day]
    assert len(same) >= 2
    altered = league.copy()
    j = altered.index[altered.match_id == same.match_id.iloc[0]][0]
    altered.loc[j, "fthg"] = 12
    f2 = build_features(altered)
    other = same.match_id.iloc[1]
    pd.testing.assert_series_equal(base.loc[other], f2.loc[other], check_names=False)


def test_scheduled_fixtures_get_features_without_results(league):
    sched = league[league.season == "2023-24"].tail(3).copy()
    hist = league[~league.match_id.isin(sched.match_id)]
    sched["status"] = "scheduled"
    for c in ["fthg", "ftag", "hs", "as"]:
        sched[c] = pd.NA
    f = build_features(pd.concat([hist, sched]))
    assert f.loc[sched.match_id].notna().all().all()


def test_promoted_flag_and_no_missing_values(league):
    extra = league[league.season == "2023-24"].copy()
    extra["season"] = "2024-25"
    extra["match_date"] = extra.match_date + pd.Timedelta(days=365)
    extra["home_team"] = extra.home_team.replace({"Fulham": "Ipswich"})
    extra["away_team"] = extra.away_team.replace({"Fulham": "Ipswich"})
    extra["match_id"] = extra.match_id + "_x"
    f = build_features(pd.concat([league, extra]))
    ips = extra[extra.home_team == "Ipswich"].match_id.iloc[0]
    assert f.loc[ips, "h_promoted"] == 1.0
    assert f.isna().sum().sum() == 0


def test_pooled_rows_mirror_home_and_away(league):
    f = build_features(league).iloc[:5]
    p = pooled(f)
    assert len(p) == 10
    home, away = p[p.side == "home"], p[p.side == "away"]
    assert np.allclose(home.t_elo.values, f.h_elo.values) and np.allclose(away.t_elo.values, f.a_elo.values)
    assert np.allclose(home.elo_diff.values, -away.elo_diff.values)
