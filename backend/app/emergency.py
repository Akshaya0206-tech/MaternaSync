"""Emergency help for a patient: which number to call, and which hospitals are close.

Nothing here alerts a doctor or sends a message, so pressing the Emergency button by mistake costs nothing: it
only shows the patient who to call. Hospitals come from OpenStreetMap (the Overpass service), and a place typed
at sign-up is turned into a position with OpenStreetMap's Nominatim. Those services receive a position or a
place name only, never a name or anything about health.
"""
import json
import math
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = "MaternaSync/1.0 (maternity care prototype)"
# The free public Overpass servers are often busy, so several are tried in turn. Set MATERNASYNC_OVERPASS_URLS
# (comma separated) to use your own server.
OVERPASS_URLS = [u.strip() for u in os.environ.get("MATERNASYNC_OVERPASS_URLS", "").split(",") if u.strip()] or [
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
MIRROR_TIMEOUT = 8
BUDGET_SECONDS = 20  # stop trying further servers after this long: someone in an emergency cannot wait
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
AWAY_KM = 25  # further than this from the saved home, the patient is treated as being away
RADII_M = (3000, 8000, 20000, 50000)
CACHE_SECONDS = 6 * 3600
# OpenStreetMap in India tags many small clinics as hospitals. Places that read like a hospital are listed first.
_HOSPITAL_WORDS = re.compile(r"hospital|medical (college|centre|center)|maternity|nursing home|health (centre|center)|\bphc\b|\bchc\b|institute of|aiims|esi\b|govt|government", re.I)
# Single-specialty places that cannot help with a pregnancy emergency are listed after the others.
_NOT_FOR_BIRTH = re.compile(r"\b(eye|dental|dentist|skin|ent|ortho|orthopaedic|orthopedic|physio|physiotherapy|veterinary|animal|pet|ayurveda|ayurvedic|homeo|homoeopathy|cosmetic|hair|cancer|psychiatric|de-?addiction)\b", re.I)

# India. Confirmed on official pages: 112 is the national emergency number (ERSS), 108 the emergency ambulance,
# 102 the free ambulance for pregnant women and newborns under the National Health Mission, 181 the women helpline.
# Which of 108 and 102 work, and who runs them, differs from state to state.
INDIA_NUMBERS = [
    {"number": "112", "label": "Emergency: police, fire and ambulance", "kind": "emergency"},
    {"number": "108", "label": "Emergency ambulance (in most states)", "kind": "ambulance"},
    {"number": "102", "label": "Free ambulance for pregnant women and newborns (in many states)", "kind": "pregnancy"},
    {"number": "181", "label": "Women helpline: support and information, not for emergencies", "kind": "support"},
]
ELSEWHERE_NUMBERS = [
    {"number": "112", "label": "Works on many mobile networks around the world and is the emergency number in the European Union. "
                              "If it does not connect, dial the emergency number of the country you are in.", "kind": "emergency"},
]


class MapLookupError(Exception):
    """The map service could not be reached or gave an unusable answer."""


def in_india(lat: float, lon: float) -> bool:
    """A coarse check on the map (it also covers parts of neighbouring countries), used only to choose which numbers to show."""
    return 6.4 <= lat <= 35.8 and 68.0 <= lon <= 97.6


def numbers_for(lat: float | None, lon: float | None) -> dict:
    if lat is not None and lon is not None and not in_india(lat, lon):
        return {"region": None, "numbers": ELSEWHERE_NUMBERS,
                "note": "You appear to be outside India. The Indian numbers are not shown. Use the emergency number of the place you are in."}
    return {"region": "India", "numbers": INDIA_NUMBERS,
            "note": "These are numbers for India. If you are somewhere else, use the local emergency number."}


def distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 6371.0 * 2 * math.asin(math.sqrt(a))


def _fetch(url: str, data: bytes | None = None, timeout: int = 14) -> dict | list:
    request = urllib.request.Request(url, data=data, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as error:
        raise MapLookupError(str(error)[:200]) from error


_cache: dict[tuple[float, float], tuple[float, list[dict]]] = {}


_preferred = {"index": 0}  # the server that answered last time is tried first


def _query(lat: float, lon: float, radius: int) -> str:
    around = f"(around:{radius},{lat:.5f},{lon:.5f})"
    return f'[out:json][timeout:20];(node["amenity"="hospital"]{around};way["amenity"="hospital"]{around};);out center tags qt 150;'


def _overpass(query: str) -> dict | list:
    started, last = time.time(), None
    start = _preferred["index"] % len(OVERPASS_URLS)
    for url in OVERPASS_URLS[start:] + OVERPASS_URLS[:start]:
        if last and time.time() - started > BUDGET_SECONDS:
            break
        try:
            payload = _fetch(url, data=urllib.parse.urlencode({"data": query}).encode(), timeout=MIRROR_TIMEOUT)
            _preferred["index"] = OVERPASS_URLS.index(url)
            return payload
        except MapLookupError as error:
            last = error
    raise last or MapLookupError("no map server answered")


def _address(tags: dict) -> str | None:
    if tags.get("addr:full"):
        return tags["addr:full"]
    parts = [" ".join(filter(None, [tags.get("addr:housenumber"), tags.get("addr:street")])), tags.get("addr:suburb"), tags.get("addr:city"), tags.get("addr:postcode")]
    text = ", ".join(p for p in parts if p)
    return text or None


def _parse(elements: list[dict], lat: float, lon: float) -> list[dict]:
    seen, hospitals = set(), []
    for element in elements:
        tags = element.get("tags") or {}
        name = (tags.get("name:en") or tags.get("name") or "").strip()
        point = element if "lat" in element else element.get("center")
        if not name or not point or "lat" not in point:
            continue
        key = (name.lower(), round(point["lat"], 3), round(point["lon"], 3))
        if key in seen:
            continue
        seen.add(key)
        hospitals.append({
            "name": name, "address": _address(tags), "lat": point["lat"], "lon": point["lon"],
            "phone": next((tags[k] for k in ("phone", "contact:phone", "contact:mobile") if tags.get(k)), None),
            "emergencyDepartment": tags.get("emergency") == "yes",
            "hospitalLike": not _NOT_FOR_BIRTH.search(name) and (tags.get("emergency") == "yes" or bool(_HOSPITAL_WORDS.search(name))),
            "distanceKm": round(distance_km(lat, lon, point["lat"], point["lon"]), 1),
            "directionsUrl": f"https://www.google.com/maps/dir/?api=1&destination={point['lat']},{point['lon']}",
        })
    return _order(hospitals)


def _order(hospitals: list[dict]) -> list[dict]:
    return sorted(hospitals, key=lambda h: (not h["hospitalLike"], h["distanceKm"]))


def _shortlist(hospitals: list[dict], limit: int) -> list[dict]:
    """The nearest real hospitals. Small clinics and odd entries are only shown when there are too few hospitals to fill a list."""
    ordered = _order(hospitals)
    real = [h for h in ordered if h["hospitalLike"]]
    return (real if len(real) >= 3 else ordered)[:limit]


def nearby_hospitals(lat: float, lon: float, limit: int = 6) -> dict:
    """Named hospitals nearest to a position, widening the search until a few are found. Never raises."""
    key = (round(lat, 2), round(lon, 2))
    cached = _cache.get(key)
    if cached and time.time() - cached[0] < CACHE_SECONDS:
        found = cached[1]
        return {"hospitals": _shortlist(_rank(found, lat, lon), limit), "error": None}
    found: list[dict] = []
    try:
        for radius in RADII_M:
            payload = _overpass(_query(lat, lon, radius))
            found = _parse(payload.get("elements", []) if isinstance(payload, dict) else [], lat, lon)
            if sum(h["hospitalLike"] for h in found) >= 3:
                break
    except MapLookupError as error:
        return {"hospitals": [], "error": f"The map service could not be reached ({error})."}
    if len(_cache) > 200:
        _cache.clear()
    _cache[key] = (time.time(), found)
    return {"hospitals": _shortlist(found, limit), "error": None}


def _rank(hospitals: list[dict], lat: float, lon: float) -> list[dict]:
    """The cache is shared by everyone near the same spot, so distances are recomputed for this position."""
    return _order([{**h, "distanceKm": round(distance_km(lat, lon, h["lat"], h["lon"]), 1)} for h in hospitals])


def geocode(place: str) -> dict | None:
    """Turn a typed area or city into a position, or None if it cannot be found."""
    if not place.strip():
        return None
    try:
        results = _fetch(f"{NOMINATIM_URL}?{urllib.parse.urlencode({'q': place.strip(), 'format': 'jsonv2', 'limit': 1})}")
    except MapLookupError:
        return None
    if not isinstance(results, list) or not results:
        return None
    try:
        return {"lat": float(results[0]["lat"]), "lon": float(results[0]["lon"]), "label": results[0].get("display_name") or place.strip()}
    except (KeyError, TypeError, ValueError):
        return None
