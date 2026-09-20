"""
Turn a real place into a level.

    python fetch_city.py berlin

Downloads a 2 x 2 km square of OpenStreetMap data around the city's landmark
(streets, building footprints and heights, water, parks, railways) and writes
a compact ../data/<city>.json that the game extrudes into a 3D district.

Map data (c) OpenStreetMap contributors, ODbL. The game credits it on screen.
"""

import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, "..", "data")
ENDPOINTS = ["https://overpass-api.de/api/interpreter",
             "https://overpass.kumi.systems/api/interpreter"]
UA = {"User-Agent": "relic-road/1.0 (personal 3D city game; contact: artgeorge.surge.sh)"}

# Each level: the centre point and how far the district reaches (metres).
CITIES = {
    "berlin":   {"name": "Berlin",         "lat": 52.5163, "lon": 13.3777, "half": 1000},  # Brandenburg Gate
    "rome":     {"name": "Rome",           "lat": 41.8902, "lon": 12.4922, "half": 1000},  # Colosseum
    "cairo":    {"name": "Cairo",          "lat": 29.9792, "lon": 31.1342, "half": 1000},  # Giza pyramids
    "istanbul": {"name": "Istanbul",       "lat": 41.0086, "lon": 28.9802, "half": 1000},  # Hagia Sophia
    "kyoto":    {"name": "Kyoto",          "lat": 35.0230, "lon": 135.7930, "half": 1000}, # Ginkaku-ji, Philosopher's Path, Nanzen-ji
    "rio":      {"name": "Rio de Janeiro", "lat": -22.9519, "lon": -43.2105, "half": 1000},# Christ the Redeemer
}

QUERY = """[out:json][timeout:240];
(
  way["building"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["building:part"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["highway"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["railway"~"^(rail|subway|tram|light_rail)$"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["natural"="water"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["waterway"~"^(riverbank|canal|river)$"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["leisure"~"^(park|garden|pitch)$"](%(s)f,%(w)f,%(n)f,%(e)f);
  way["landuse"~"^(grass|forest|cemetery|meadow|village_green)$"](%(s)f,%(w)f,%(n)f,%(e)f);
  node["tourism"~"^(attraction|museum|artwork|viewpoint)$"](%(s)f,%(w)f,%(n)f,%(e)f);
  node["historic"](%(s)f,%(w)f,%(n)f,%(e)f);
);
out body geom qt;
"""

ROAD_WIDTH = {          # metres of carriageway per OSM road class
    "motorway": 16, "trunk": 14, "primary": 12, "secondary": 10, "tertiary": 9,
    "residential": 7.5, "unclassified": 7, "living_street": 6, "service": 4.5,
    "pedestrian": 6, "footway": 2.2, "path": 1.8, "steps": 2, "cycleway": 2.4,
    "motorway_link": 7, "trunk_link": 7, "primary_link": 7, "secondary_link": 6,
    "tertiary_link": 6, "track": 3,
}
LEVEL_H = 3.2           # metres per storey when only the storey count is known


def fetch(city):
    c = CITIES[city]
    d_lat = c["half"] / 110540.0
    d_lon = c["half"] / (111320.0 * math.cos(math.radians(c["lat"])))
    box = {"s": c["lat"] - d_lat, "n": c["lat"] + d_lat,
           "w": c["lon"] - d_lon, "e": c["lon"] + d_lon}
    body = urllib.parse.urlencode({"data": QUERY % box}).encode()
    last = None
    for url in ENDPOINTS:
        for attempt in range(3):
            try:
                req = urllib.request.Request(url, data=body, headers=UA)
                with urllib.request.urlopen(req, timeout=300) as r:
                    return json.loads(r.read().decode("utf-8"))
            except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
                last = e
                print("   %s attempt %d failed: %s" % (url.split("/")[2], attempt + 1, e))
                time.sleep(8 * (attempt + 1))
    raise SystemExit("could not download map data: %s" % last)


def height_of(tags):
    """Building height in metres, from the tags if they have one."""
    for key in ("height", "building:height"):
        v = tags.get(key)
        if v:
            try:
                return max(2.0, float(str(v).replace("m", "").strip()))
            except ValueError:
                pass
    for key in ("building:levels", "levels"):
        v = tags.get(key)
        if v:
            try:
                return max(2.0, float(str(v).split(";")[0]) * LEVEL_H + 1.0)
            except ValueError:
                pass
    return None


def kind_of(tags):
    """A rough material/shape class, so the game can pick a look."""
    b = (tags.get("building") or tags.get("building:part") or "yes").lower()
    if tags.get("historic") or b in ("cathedral", "church", "chapel", "mosque", "temple",
                                     "synagogue", "monument", "castle", "palace", "ruins"):
        return "monument"
    if b in ("commercial", "office", "retail", "supermarket", "hotel", "civic", "government",
             "university", "hospital", "public", "train_station", "stadium"):
        return "civic"
    if b in ("industrial", "warehouse", "garage", "garages", "hangar", "shed", "roof"):
        return "industrial"
    if b in ("house", "detached", "semidetached_house", "bungalow", "terrace", "farm"):
        return "house"
    return "block"


def project(lat0, lon0):
    k_lon = 111320.0 * math.cos(math.radians(lat0))
    return lambda lat, lon: ((lon - lon0) * k_lon, -(lat - lat0) * 110540.0)


def ring(geom, to_xz, half, close=True):
    """OSM way geometry -> flat [x, z, ...] in decimetres, clipped to the square."""
    out = []
    for p in geom or []:
        x, z = to_xz(p["lat"], p["lon"])
        if abs(x) > half * 1.6 or abs(z) > half * 1.6:
            continue
        out.append(round(x * 10))
        out.append(round(z * 10))
    if close and len(out) >= 4 and out[0] == out[-2] and out[1] == out[-1]:
        out = out[:-2]          # the game closes rings itself
    return out


def area_of(flat):
    a = 0.0
    n = len(flat) // 2
    for i in range(n):
        x1, z1 = flat[i * 2], flat[i * 2 + 1]
        x2, z2 = flat[((i + 1) % n) * 2], flat[((i + 1) % n) * 2 + 1]
        a += x1 * z2 - x2 * z1
    return abs(a) / 2 / 100.0          # m2 (coords are decimetres)


def build(city):
    c = CITIES[city]
    print("%s: downloading map data..." % c["name"])
    data = fetch(city)
    to_xz = project(c["lat"], c["lon"])
    half = c["half"]

    out = {"id": city, "name": c["name"], "centre": [c["lat"], c["lon"]], "half": half,
           "attribution": "Map data (c) OpenStreetMap contributors (ODbL)",
           "buildings": [], "roads": [], "water": [], "green": [], "rail": [], "places": []}
    seen_place = set()

    for el in data.get("elements", []):
        tags = el.get("tags") or {}
        if el["type"] == "node":
            name = tags.get("name")
            if not name or name in seen_place:
                continue
            x, z = to_xz(el["lat"], el["lon"])
            if abs(x) > half or abs(z) > half:
                continue
            seen_place.add(name)
            out["places"].append({"n": name, "x": round(x, 1), "z": round(z, 1),
                                  "k": tags.get("historic") or tags.get("tourism") or "place"})
            continue
        if el["type"] != "way":
            continue
        geom = el.get("geometry")
        if not geom:
            continue

        if "building" in tags or "building:part" in tags:
            flat = ring(geom, to_xz, half)
            if len(flat) < 6 or area_of(flat) < 12:
                continue
            h = height_of(tags)
            k = kind_of(tags)
            rec = [k, round(h, 1) if h else 0, flat]
            if tags.get("name"):
                rec.append(tags["name"])
                if tags["name"] not in seen_place:
                    seen_place.add(tags["name"])
                    xs = flat[0::2]; zs = flat[1::2]
                    out["places"].append({"n": tags["name"], "x": round(sum(xs) / len(xs) / 10, 1),
                                          "z": round(sum(zs) / len(zs) / 10, 1),
                                          "k": tags.get("historic") or tags.get("tourism") or "building"})
            out["buildings"].append(rec)
        elif "highway" in tags:
            hw = tags["highway"]
            if hw in ("proposed", "construction", "bus_stop", "platform"):
                continue
            flat = ring(geom, to_xz, half, close=False)
            if len(flat) < 4:
                continue
            w = ROAD_WIDTH.get(hw, 6)
            lanes = tags.get("lanes")
            if lanes:
                try:
                    w = max(w, float(str(lanes).split(";")[0]) * 3.2)
                except ValueError:
                    pass
            out["roads"].append([hw, round(w, 1), flat])
        elif "railway" in tags:
            flat = ring(geom, to_xz, half, close=False)
            if len(flat) >= 4:
                out["rail"].append([tags["railway"], flat])
        elif tags.get("natural") == "water" or "waterway" in tags:
            flat = ring(geom, to_xz, half)
            if len(flat) >= 6:
                out["water"].append(flat)
        else:
            flat = ring(geom, to_xz, half)
            if len(flat) >= 6 and area_of(flat) > 60:
                out["green"].append(flat)

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.abspath(os.path.join(OUT_DIR, city + ".json"))
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"))
    mb = os.path.getsize(path) / 1e6
    with_h = sum(1 for b in out["buildings"] if b[1])
    print("   %-9s %5d buildings (%d with real heights), %4d roads, %3d water, %3d parks, "
          "%3d named places -> %.1f MB"
          % (c["name"], len(out["buildings"]), with_h, len(out["roads"]), len(out["water"]),
             len(out["green"]), len(out["places"]), mb))
    return out


if __name__ == "__main__":
    names = sys.argv[1:] or list(CITIES)
    for n in names:
        if n not in CITIES:
            raise SystemExit("unknown city %r; try: %s" % (n, ", ".join(CITIES)))
        build(n)
        time.sleep(3)          # be polite to the free Overpass servers
