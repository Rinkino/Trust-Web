# Betting evaluation: the model against bookmaker prices

Page: **Advanced statistics → Betting vs the market** (`/betting`). Code: `ml/eplpred/value.py`,
pipeline stages `persist_odds`, `value_backtest`, `persist_value`. Tables: `epl_match_odds`,
`epl_value_backtest`.

## Question

Would betting on the model's probabilities have made money against the odds actually on offer?
Better log loss than a league-average baseline (the 11.1% validation improvement of the
result model) does not answer this: a bet only pays if the model is more accurate than the
*bookmakers*, by more than their margin.

## Data

football-data.co.uk season files. Per match, for the match result (1X2) and over/under 2.5 goals:

| Stage | When | Bookmakers kept |
|---|---|---|
| pre-closing | Friday afternoon for weekend games, Tuesday afternoon for midweek | average, best, Bet365, Pinnacle |
| closing | last available before kickoff | the same |

Only complete markets with a plausible margin are stored (`ingest.parse_odds`); anything else
is dropped and logged in the audit. Odds are stored insert-only in `epl_match_odds`, one row
per (match, content hash): a revision by the source is added next to the old version.
There are no per-quote timestamps, no live odds and no archive for both teams to score,
corners or cards, so those markets are not evaluated.

## Method

1. Probabilities come from the existing walk-forward backtest: every match was predicted by
   models refitted on matches before its week. Nothing is retrained for betting.
2. For each match, market and selection: implied probability `1/odds`; fair market probability
   = implied probabilities of the average pre-closing market scaled to sum to 1; break-even
   `1/odds taken`; expected value `p × odds − 1`; edge `p − fair` (probability points, not a return).
3. Bets are flat 1-unit stakes at the **pre-closing** price of the chosen source. Closing odds are
   used only for closing-line value: `odds taken × fair closing probability − 1`.
4. Strategies, fixed in advance and all reported (none chosen after the fact):
   EV > 0, EV ≥ 5%, EV ≥ 10%, and a filtered rule (EV ≥ 5%, edge ≥ 2 pts, probability ≥ 15%,
   at least 200 earlier selections in the same 10% probability band; "earlier" means strictly
   earlier dates, so the filter uses no future results).
5. Three sources of probabilities on identical matches: A league average, B the model selected
   for that market's target, C the margin-free average market (which can only bet where the
   best price beats the average market's fair price, i.e. price shopping).
6. Reported per period (validation 2023-25, held-out 2025-26, current season to date), per season,
   market and price source: bets, win rate, average odds and break-even, profit, ROI with a 95%
   bootstrap interval (resampling matches), maximum drawdown, closing-line value, and log loss,
   Brier score and calibration of the probabilities on every eligible match.
7. Fewer than 200 bets, or an interval that spans zero, is shown as "too few" / "unclear".
   A positive interval is described as positive on past matches, never as profitable.

## Limitations

* "Best price" across many bookmakers flatters every strategy: it needs accounts everywhere,
  and bookmakers restrict winning customers.
* One pre-closing snapshot per match; predictions published earlier in the week may have
  faced different prices.
* Void, postponed and abandoned matches are not in the data.
