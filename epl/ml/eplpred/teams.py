"""Team-name normalisation.

Canonical names follow football-data.co.uk, the results source. Every other source
is mapped onto them. Unknown names are rejected instead of guessed.
"""
from __future__ import annotations

import re
import unicodedata

CANONICAL = {
    "Arsenal", "Aston Villa", "Barnsley", "Birmingham", "Blackburn", "Blackpool", "Bolton",
    "Bournemouth", "Bradford", "Brentford", "Brighton", "Burnley", "Cardiff", "Charlton",
    "Chelsea", "Coventry", "Crystal Palace", "Derby", "Everton", "Fulham", "Huddersfield",
    "Hull", "Ipswich", "Leeds", "Leicester", "Liverpool", "Luton", "Man City", "Man United",
    "Middlesbrough", "Newcastle", "Norwich", "Nott'm Forest", "Portsmouth", "QPR", "Reading",
    "Sheffield United", "Sheffield Weds", "Southampton", "Stoke", "Sunderland", "Swansea",
    "Tottenham", "Watford", "West Brom", "West Ham", "Wigan", "Wimbledon", "Wolves",
}

# Lower-cased, punctuation-stripped alias -> canonical
_ALIASES = {
    "man utd": "Man United", "manchester united": "Man United", "man united": "Man United",
    "manchester city": "Man City", "man city": "Man City",
    "spurs": "Tottenham", "tottenham hotspur": "Tottenham",
    "nottm forest": "Nott'm Forest", "nottingham forest": "Nott'm Forest", "nott'm forest": "Nott'm Forest",
    "wolverhampton": "Wolves", "wolverhampton wanderers": "Wolves",
    "west ham united": "West Ham", "newcastle united": "Newcastle",
    "brighton and hove albion": "Brighton", "brighton & hove albion": "Brighton", "brighton hove albion": "Brighton",
    "leeds united": "Leeds", "leicester city": "Leicester", "ipswich town": "Ipswich",
    "hull city": "Hull", "coventry city": "Coventry", "luton town": "Luton",
    "sheffield utd": "Sheffield United", "sheff utd": "Sheffield United",
    "sheffield wednesday": "Sheffield Weds", "west bromwich albion": "West Brom",
    "afc bournemouth": "Bournemouth", "norwich city": "Norwich", "cardiff city": "Cardiff",
    "swansea city": "Swansea", "stoke city": "Stoke", "queens park rangers": "QPR",
    "huddersfield town": "Huddersfield", "birmingham city": "Birmingham",
    "blackburn rovers": "Blackburn", "bolton wanderers": "Bolton", "wigan athletic": "Wigan",
    "derby county": "Derby", "charlton athletic": "Charlton", "bradford city": "Bradford",
}


def _key(name: str) -> str:
    s = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    s = s.lower().replace("’", "'").strip()
    s = re.sub(r"\s+", " ", s)
    return s


_LOOKUP = {_key(c): c for c in CANONICAL}
_LOOKUP.update({_key(k): v for k, v in _ALIASES.items()})
# Also accept the alias without apostrophes ("nottm forest")
_LOOKUP.update({k.replace("'", ""): v for k, v in list(_LOOKUP.items())})


class UnknownTeam(ValueError):
    pass


def normalize_team(name: object) -> str:
    if not isinstance(name, str) or not name.strip():
        raise UnknownTeam(f"empty team name: {name!r}")
    k = _key(name)
    if k in _LOOKUP:
        return _LOOKUP[k]
    k2 = k.replace("'", "")
    if k2 in _LOOKUP:
        return _LOOKUP[k2]
    raise UnknownTeam(f"unknown team name: {name!r}")


def slug(team: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", _key(team)).strip("-")
