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
    # Championship (and its predecessor, the First Division) clubs not listed above
    "Bristol City", "Bristol Rvs", "Burton", "Colchester", "Crewe", "Doncaster", "Gillingham", "Grimsby",
    "Milton Keynes Dons", "Millwall", "Oxford", "Peterboro", "Plymouth", "Preston", "Rotherham", "Scunthorpe",
    "Southend", "Stockport", "Swindon", "Tranmere", "Walsall", "Wrexham", "Wycombe", "Yeovil", "Lincoln",
    # La Liga
    "Alaves", "Albacete", "Almeria", "Ath Bilbao", "Ath Madrid", "Barcelona", "Betis", "Cadiz", "Celta",
    "Cordoba", "Eibar", "Elche", "Espanol", "Getafe", "Gimnastic", "Girona", "Granada", "Hercules", "Huesca",
    "La Coruna", "Las Palmas", "Leganes", "Levante", "Malaga", "Mallorca", "Murcia", "Numancia", "Osasuna",
    "Oviedo", "Real Madrid", "Recreativo", "Santander", "Sevilla", "Sociedad", "Sp Gijon", "Tenerife",
    "Valencia", "Valladolid", "Vallecano", "Villarreal", "Xerez", "Zaragoza",
    # Serie A
    "Ancona", "Ascoli", "Atalanta", "Bari", "Benevento", "Bologna", "Brescia", "Cagliari", "Carpi", "Catania",
    "Cesena", "Chievo", "Como", "Cremonese", "Crotone", "Empoli", "Fiorentina", "Frosinone", "Genoa", "Inter",
    "Juventus", "Lazio", "Lecce", "Livorno", "Messina", "Milan", "Modena", "Monza", "Napoli", "Novara",
    "Palermo", "Parma", "Perugia", "Pescara", "Piacenza", "Pisa", "Reggina", "Roma", "Salernitana", "Sampdoria",
    "Sassuolo", "Siena", "Spal", "Spezia", "Torino", "Treviso", "Udinese", "Venezia", "Verona", "Vicenza",
    # Bundesliga
    "Aachen", "Augsburg", "Bayern Munich", "Bielefeld", "Bochum", "Braunschweig", "Cottbus", "Darmstadt",
    "Dortmund", "Duisburg", "Ein Frankfurt", "Elversberg", "FC Koln", "Fortuna Dusseldorf", "Freiburg", "Greuther Furth",
    "Hamburg", "Hannover", "Hansa Rostock", "Heidenheim", "Hertha", "Hoffenheim", "Holstein Kiel",
    "Ingolstadt", "Kaiserslautern", "Karlsruhe", "Leverkusen", "M'gladbach", "Mainz", "Munich 1860",
    "Nurnberg", "Paderborn", "RB Leipzig", "Schalke 04", "St Pauli", "Stuttgart", "Union Berlin",
    "Unterhaching", "Werder Bremen", "Wolfsburg",
    # Ligue 1
    "Ajaccio", "Ajaccio GFCO", "Amiens", "Angers", "Arles", "Auxerre", "Bastia", "Bordeaux", "Boulogne",
    "Brest", "Caen", "Clermont", "Dijon", "Evian Thonon Gaillard", "Grenoble", "Guingamp", "Istres",
    "Le Havre", "Le Mans", "Lens", "Lille", "Lorient", "Lyon", "Marseille", "Metz", "Monaco", "Montpellier",
    "Nancy", "Nantes", "Nice", "Nimes", "Paris FC", "Paris SG", "Reims", "Rennes", "Sedan", "Sochaux",
    "St Etienne", "Strasbourg", "Toulouse", "Troyes", "Valenciennes",
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
    "preston north end": "Preston", "plymouth argyle": "Plymouth", "oxford united": "Oxford", "oxford utd": "Oxford",
    "rotherham united": "Rotherham", "peterborough": "Peterboro", "peterborough united": "Peterboro",
    "mk dons": "Milton Keynes Dons", "milton keynes": "Milton Keynes Dons", "sheffield wed": "Sheffield Weds",
    "bristol rovers": "Bristol Rvs", "doncaster rovers": "Doncaster", "scunthorpe united": "Scunthorpe",
    "southend united": "Southend", "stockport county": "Stockport", "swindon town": "Swindon",
    "tranmere rovers": "Tranmere", "wycombe wanderers": "Wycombe", "yeovil town": "Yeovil",
    "crewe alexandra": "Crewe", "colchester united": "Colchester", "grimsby town": "Grimsby",
    "burton albion": "Burton", "lincoln city": "Lincoln", "wrexham afc": "Wrexham", "west brom": "West Brom", "qpr": "QPR",
    # Spain
    "athletic club": "Ath Bilbao", "athletic bilbao": "Ath Bilbao", "atletico madrid": "Ath Madrid",
    "atletico de madrid": "Ath Madrid", "atl. madrid": "Ath Madrid", "fc barcelona": "Barcelona",
    "real betis": "Betis", "celta vigo": "Celta", "rc celta": "Celta", "rcd espanyol": "Espanol", "espanyol": "Espanol",
    "real sociedad": "Sociedad", "deportivo alaves": "Alaves", "rayo vallecano": "Vallecano",
    "deportivo la coruna": "La Coruna", "deportivo": "La Coruna", "rcd mallorca": "Mallorca", "real mallorca": "Mallorca",
    "sevilla fc": "Sevilla", "valencia cf": "Valencia", "villarreal cf": "Villarreal", "villareal": "Villarreal",
    "real valladolid": "Valladolid", "real zaragoza": "Zaragoza", "sporting gijon": "Sp Gijon", "real oviedo": "Oviedo",
    "racing santander": "Santander", "ca osasuna": "Osasuna", "getafe cf": "Getafe", "girona fc": "Girona",
    "granada cf": "Granada", "ud las palmas": "Las Palmas", "cd leganes": "Leganes", "levante ud": "Levante",
    "r. racing club": "Santander", "rc deportivo": "La Coruna", "rcd espanyol de barcelona": "Espanol",
    "elche cf": "Elche", "cadiz cf": "Cadiz", "ud almeria": "Almeria", "sd huesca": "Huesca", "sd eibar": "Eibar",
    "malaga cf": "Malaga", "real murcia": "Murcia", "recreativo huelva": "Recreativo",
    # Italy
    "ac milan": "Milan", "inter milan": "Inter", "internazionale": "Inter", "fc internazionale": "Inter",
    "as roma": "Roma", "ss lazio": "Lazio", "ssc napoli": "Napoli", "juventus fc": "Juventus",
    "hellas verona": "Verona", "chievo verona": "Chievo", "spal 2013": "Spal", "us lecce": "Lecce",
    "ac monza": "Monza", "parma calcio": "Parma", "udinese calcio": "Udinese", "torino fc": "Torino",
    "genoa cfc": "Genoa", "bologna fc": "Bologna", "acf fiorentina": "Fiorentina", "us sassuolo": "Sassuolo",
    "uc sampdoria": "Sampdoria", "cagliari calcio": "Cagliari", "empoli fc": "Empoli", "como 1907": "Como",
    "us cremonese": "Cremonese", "venezia fc": "Venezia", "us salernitana": "Salernitana", "ac pisa": "Pisa",
    # Germany
    "bayern munchen": "Bayern Munich", "fc bayern munchen": "Bayern Munich", "bayern": "Bayern Munich",
    "borussia dortmund": "Dortmund", "bayer leverkusen": "Leverkusen", "bayer 04 leverkusen": "Leverkusen",
    "borussia monchengladbach": "M'gladbach", "monchengladbach": "M'gladbach", "gladbach": "M'gladbach",
    "eintracht frankfurt": "Ein Frankfurt", "1. fc koln": "FC Koln", "fc cologne": "FC Koln", "koln": "FC Koln",
    "vfb stuttgart": "Stuttgart", "vfl wolfsburg": "Wolfsburg", "sv werder bremen": "Werder Bremen",
    "werder": "Werder Bremen", "tsg hoffenheim": "Hoffenheim", "tsg 1899 hoffenheim": "Hoffenheim",
    "1899 hoffenheim": "Hoffenheim", "sc freiburg": "Freiburg", "1. fsv mainz 05": "Mainz", "mainz 05": "Mainz",
    "fc augsburg": "Augsburg", "rb leipzig": "RB Leipzig", "leipzig": "RB Leipzig", "1. fc union berlin": "Union Berlin",
    "hertha berlin": "Hertha", "hertha bsc": "Hertha", "fc schalke 04": "Schalke 04", "schalke": "Schalke 04",
    "vfl bochum": "Bochum", "vfl bochum 1848": "Bochum", "1. fc heidenheim": "Heidenheim", "1. fc heidenheim 1846": "Heidenheim",
    "fc st. pauli": "St Pauli", "st. pauli": "St Pauli", "holstein kiel": "Holstein Kiel", "sv darmstadt 98": "Darmstadt",
    "hamburger sv": "Hamburg", "hannover 96": "Hannover", "fortuna dusseldorf": "Fortuna Dusseldorf",
    "1. fc nurnberg": "Nurnberg", "spvgg greuther furth": "Greuther Furth", "arminia bielefeld": "Bielefeld",
    "sc paderborn 07": "Paderborn", "1. fc kaiserslautern": "Kaiserslautern", "karlsruher sc": "Karlsruhe",
    "fc ingolstadt 04": "Ingolstadt", "eintracht braunschweig": "Braunschweig", "energie cottbus": "Cottbus",
    "sv elversberg": "Elversberg", "sport-club freiburg": "Freiburg",
    "msv duisburg": "Duisburg", "hansa rostock": "Hansa Rostock", "alemannia aachen": "Aachen", "tsv 1860 munchen": "Munich 1860",
    # France
    "paris saint-germain": "Paris SG", "paris saint germain": "Paris SG", "psg": "Paris SG",
    "olympique de marseille": "Marseille", "olympique marseille": "Marseille", "olympique lyonnais": "Lyon",
    "as monaco": "Monaco", "losc lille": "Lille", "lille osc": "Lille", "ogc nice": "Nice", "rc lens": "Lens",
    "stade rennais": "Rennes", "stade rennais fc": "Rennes", "stade de reims": "Reims", "fc nantes": "Nantes",
    "rc strasbourg": "Strasbourg", "rc strasbourg alsace": "Strasbourg", "montpellier hsc": "Montpellier",
    "toulouse fc": "Toulouse", "stade brestois": "Brest", "stade brestois 29": "Brest", "fc lorient": "Lorient",
    "fc metz": "Metz", "aj auxerre": "Auxerre", "angers sco": "Angers", "le havre ac": "Le Havre", "havre athletic club": "Le Havre", "le mans fc": "Le Mans",
    "as saint-etienne": "St Etienne", "saint-etienne": "St Etienne", "saint etienne": "St Etienne",
    "girondins de bordeaux": "Bordeaux", "fc girondins de bordeaux": "Bordeaux", "clermont foot": "Clermont",
    "estac troyes": "Troyes", "es troyes ac": "Troyes", "sm caen": "Caen", "dijon fco": "Dijon", "nimes olympique": "Nimes",
    "en avant guingamp": "Guingamp", "amiens sc": "Amiens", "as nancy": "Nancy", "fc sochaux": "Sochaux",
    "ac ajaccio": "Ajaccio", "sc bastia": "Bastia", "valenciennes fc": "Valenciennes", "paris fc": "Paris FC",
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
