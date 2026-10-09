"""Model B: team-strength Poisson model (Maher / Dixon-Coles family).

For each statistic s, on matches before the cutoff:

    log E[home_s] = c + home_adv + att[home] + def[away] + p_att*promoted[home] + p_def*promoted[away]
    log E[away_s] = c            + att[away] + def[home] + p_att*promoted[away] + p_def*promoted[home]

fitted by L2-penalised, time-weighted maximum likelihood (weights halve every
`halflife_days`). Team effects shrink to zero (league average); the promoted-team
offsets stop newly promoted sides from starting at league average. Goals also get
the Dixon-Coles low-score correlation rho. Over-dispersion is measured on the
training residuals and, where present, the negative binomial is used instead of
the Poisson for probabilities and intervals.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.optimize import minimize, minimize_scalar

from ..config import STATS
from ..distributions import KMAX, estimate_alpha, pmf, score_matrix
from . import STAT_KEYS, Prediction


def _fit_stat(hi, ai, yh, ya, ph, pa, w, n_teams, l2):
    """Returns params [c, home, p_att, p_def, att(n), def(n)]."""
    n_par = 4 + 2 * n_teams

    def f(theta):
        c, hadv, patt, pdef = theta[:4]
        att, de = theta[4:4 + n_teams], theta[4 + n_teams:]
        eh = c + hadv + att[hi] + de[ai] + patt * ph + pdef * pa
        ea = c + att[ai] + de[hi] + patt * pa + pdef * ph
        mh, ma = np.exp(eh), np.exp(ea)
        nll = np.sum(w * (mh - yh * eh)) + np.sum(w * (ma - ya * ea))
        reg = 0.5 * l2 * (att @ att + de @ de)
        rh, ra = w * (mh - yh), w * (ma - ya)
        g = np.zeros(n_par)
        g[0] = rh.sum() + ra.sum()
        g[1] = rh.sum()
        g[2] = rh @ ph + ra @ pa
        g[3] = rh @ pa + ra @ ph
        ga = np.bincount(hi, rh, n_teams) + np.bincount(ai, ra, n_teams) + l2 * att
        gd = np.bincount(ai, rh, n_teams) + np.bincount(hi, ra, n_teams) + l2 * de
        g[4:4 + n_teams], g[4 + n_teams:] = ga, gd
        return nll + reg, g

    y0 = np.log(max(np.average(np.concatenate([yh, ya]), weights=np.concatenate([w, w])), 1e-3))
    x0 = np.zeros(n_par)
    x0[0] = y0
    r = minimize(f, x0, jac=True, method="L-BFGS-B", options={"maxiter": 500})
    return r.x


class PoissonStrength:
    name = "poisson_strength"
    algorithm = "Time-weighted L2-penalised Poisson team-strength model per statistic (+ Dixon-Coles rho for goals, NB dispersion)"

    def __init__(self, halflife_days: float = 240.0, l2: float = 2.0, window_days: int = 3 * 365):
        self.halflife_days, self.l2, self.window_days = halflife_days, l2, window_days

    def config(self) -> dict:
        return {"halflife_days": self.halflife_days, "l2": self.l2, "window_days": self.window_days}

    def fit(self, train: pd.DataFrame, cutoff) -> "PoissonStrength":
        cutoff = pd.Timestamp(cutoff)
        d = train[train.match_date >= cutoff - pd.Timedelta(days=self.window_days)]
        age = (cutoff - d.match_date).dt.days.values.astype(float)
        w = 0.5 ** (age / self.halflife_days)
        teams = sorted(set(d.home_team) | set(d.away_team))
        self.idx = {t: i for i, t in enumerate(teams)}
        self.n = len(teams)
        hi = d.home_team.map(self.idx).values
        ai = d.away_team.map(self.idx).values
        ph, pa = d.h_promoted.values.astype(float), d.a_promoted.values.astype(float)
        self.params, self.alpha = {}, {}
        # Effective l2 grows with total weight so shrinkage is comparable across windows.
        l2 = self.l2 * (w.sum() / 380.0)
        for s in STAT_KEYS:
            hcol, acol = STATS[s]
            ok = d[hcol].notna().values & d[acol].notna().values
            yh, ya = d[hcol].values[ok].astype(float), d[acol].values[ok].astype(float)
            th = _fit_stat(hi[ok], ai[ok], yh, ya, ph[ok], pa[ok], w[ok], self.n, l2)
            self.params[s] = th
            mh, ma = self._mu_arrays(th, hi[ok], ai[ok], ph[ok], pa[ok])
            # Dispersion from the most recent two seasons' fitted values
            recent = d.match_date.values[ok] >= np.datetime64(cutoff - pd.Timedelta(days=730))
            self.alpha[s] = (estimate_alpha(yh[recent], mh[recent]), estimate_alpha(ya[recent], ma[recent]))
            if s == "goals":
                self.rho = self._fit_rho(yh[recent].astype(int), ya[recent].astype(int), mh[recent], ma[recent])
        return self

    def _mu_arrays(self, th, hi, ai, ph, pa):
        n = self.n
        c, hadv, patt, pdef = th[:4]
        att, de = th[4:4 + n], th[4 + n:]
        mh = np.exp(c + hadv + att[hi] + de[ai] + patt * ph + pdef * pa)
        ma = np.exp(c + att[ai] + de[hi] + patt * pa + pdef * ph)
        return mh, ma

    @staticmethod
    def _fit_rho(yh, ya, mh, ma) -> float:
        def nll(rho):
            tau = np.ones(len(yh))
            m00 = (yh == 0) & (ya == 0)
            m01 = (yh == 0) & (ya == 1)
            m10 = (yh == 1) & (ya == 0)
            m11 = (yh == 1) & (ya == 1)
            tau[m00] = 1 - mh[m00] * ma[m00] * rho
            tau[m01] = 1 + mh[m01] * rho
            tau[m10] = 1 + ma[m10] * rho
            tau[m11] = 1 - rho
            if np.any(tau <= 0):
                return 1e12
            return -np.sum(np.log(tau))
        r = minimize_scalar(nll, bounds=(-0.25, 0.15), method="bounded")
        return float(r.x)

    def predict(self, rows: pd.DataFrame) -> list[Prediction]:
        out = []
        for mid, r in rows.iterrows():
            mu = {}
            for s in STAT_KEYS:
                th = self.params[s]
                n = self.n
                c, hadv, patt, pdef = th[:4]
                att, de = th[4:4 + n], th[4 + n:]
                ih, ia = self.idx.get(r.home_team), self.idx.get(r.away_team)
                ah = att[ih] if ih is not None else 0.0
                dh = de[ih] if ih is not None else 0.0
                aa = att[ia] if ia is not None else 0.0
                da = de[ia] if ia is not None else 0.0
                ph, pa = float(r.h_promoted), float(r.a_promoted)
                mu[s] = (float(np.exp(c + hadv + ah + da + patt * ph + pdef * pa)),
                         float(np.exp(c + aa + dh + patt * pa + pdef * ph)))
            out.append(Prediction(mid, mu, dict(self.alpha), self.rho))
        return out


def scoreline_matrix(pred: Prediction) -> np.ndarray:
    mh, ma = pred.mu["goals"]
    ah, aa = pred.alpha.get("goals", (0.0, 0.0))
    return score_matrix(pmf(mh, ah, KMAX["goals"]), pmf(ma, aa, KMAX["goals"]), pred.rho, mh, ma)
