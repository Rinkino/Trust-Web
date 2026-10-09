# Data

## Sources

### football-data.co.uk (results and statistics)

- URL pattern: `https://www.football-data.co.uk/mmz4281/<YYZZ>/E0.csv` (e.g. `2526` for 2025/26), seasons 2000/01
  onward; the current season file grows as matches are played.
- Column key: `https://www.football-data.co.uk/notes.txt`. Fields used (`eplpred/ingest.py`, `COLUMN_MAP`):
  `Date`, `Time` (from 2019/20), `HomeTeam`/`HT`, `AwayTeam`/`AT`, `FTHG`/`HG`, `FTAG`/`AG`, `FTR`/`Res`, `HTHG`, `HTAG`,
  `HS`, `AS`, `HST`, `AST`, `HC`, `AC`, `HF`, `AF`, `HY`, `AY`, `HR`, `AR`, `HxG`, `AxG` (2026/27 only), `Referee`, and
  average odds `AvgH/AvgD/AvgA` (`BbAv*` in older seasons) and `Avg>2.5`/`Avg<2.5`.
- English yellow-card counts exclude the first yellow of a two-yellow dismissal (per the notes file).
- Redistribution terms are not stated, so raw files are not committed; each pipeline run downloads them and records
  HTTP status, size and SHA-256 in `epl_data_source_audit`.

### fixturedownload.com (schedule)

- `https://fixturedownload.com/feed/json/epl-<start year>`: every fixture of the season with UTC kick-off and round.
- Used only for upcoming fixtures and kick-off times. Its scores are compared with football-data's; disagreements are
  reported in the audit, never applied. A fixture marked played in the feed but absent from the results file stays
  ineligible until the results file confirms it.

A free official Premier League fixture API with documented terms was not available; the schedule feed was chosen
because it is plain, documented by its site, and cross-checked against the results source.

## Validation rules

Each row is accepted or rejected with a reason (stored in the audit):

- required columns present (`Date`, teams, full-time goals); missing statistic columns are allowed and stored as null;
- dates parse (`dd/mm/yy` or `dd/mm/yyyy`) and fall within the season window;
- team names map to a canonical name (`eplpred/teams.py`); unknown names are rejected, not guessed;
- home ≠ away; counts are non-negative integers below plausibility ceilings;
- `FTR` agrees with the score; half-time goals do not exceed full-time goals;
- shots on target greater than shots: both shot fields set to null (result kept), with a warning;
- duplicate `(season, home, away)`: later rows rejected;
- rows with extra trailing fields are accepted only if the extras are empty (2003/04 and 2004/05 files have such rows).

Encoding is detected per file (UTF-8 with BOM, Windows-1252 or Latin-1).

## Identity and idempotency

`match_id = <season>_<home-slug>_<away-slug>`. Each pairing occurs once per league season, so the id is stable across
sources and postponements. Ingestion is an upsert on `match_id`:

- unchanged completed rows are skipped;
- a completed row whose result or statistics differ from what is stored is **not** written; it is logged as a conflict;
- a database trigger additionally rejects any update to the result fields of a completed match.

## Coverage (first full run)

- 9,930 completed matches: 2000/01 to 2025/26 (380 per season) and 50 matches of 2026/27; 330 scheduled fixtures.
- Shots, shots on target, corners, fouls, cards: present for every match except 5 rows with contradictory shot data
  (2000/01 and 2021/22), whose shot fields were nulled.
- Kick-off times from 2019/20; average odds from 2005/06; xG only in 2026/27.

The Data status page shows the live numbers for the latest run.
