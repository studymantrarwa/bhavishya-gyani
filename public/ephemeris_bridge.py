#!/usr/bin/env python3
"""
Bhavishya Gyani local Swiss Ephemeris JSON-line bridge.

Install locally:
  python -m pip install pyswisseph

Run:
  python ephemeris_bridge.py

The Node server can call it through STUDY_MANTRA_EPHEMERIS_CMD.
The bridge reads one JSON object per line and writes one JSON object per line.

Input:
{
  "dob":"2000-01-01",
  "time":"12:30",
  "latitude":25.4358,
  "longitude":81.8463,
  "timezone":5.5
}

This is local computation, not a third-party astrology API.
"""
import sys, json, math
import swisseph as swe

PLANETS = {
    "Sun": swe.SUN, "Moon": swe.MOON, "Mars": swe.MARS,
    "Mercury": swe.MERCURY, "Jupiter": swe.JUPITER,
    "Venus": swe.VENUS, "Saturn": swe.SATURN,
}
SID_LAHIRI = swe.SIDM_LAHIRI

def norm(x):
    return (x % 360.0 + 360.0) % 360.0

def julian_day(inp):
    dob = str(inp["dob"])
    hh, mm = map(int, str(inp.get("time","12:00")).split(":")[:2])
    ss = int(str(inp.get("time","12:00")).split(":")[2]) if len(str(inp.get("time","12:00")).split(":")) > 2 else 0
    tz = float(inp.get("timezone", 5.5))
    local_hours = hh + mm/60.0 + ss/3600.0
    ut_hours = local_hours - tz
    y,m,d = map(int, dob.split("-"))
    # Swiss Ephemeris accepts UT hours that may be outside 0..24.
    return swe.julday(y,m,d,ut_hours, swe.GREG_CAL)

def main(inp):
    jd = julian_day(inp)
    swe.set_sid_mode(SID_LAHIRI)
    flags = swe.FLG_SWIEPH | swe.FLG_SPEED | swe.FLG_SIDEREAL
    planets = {}
    for name, pid in PLANETS.items():
        xx, ret = swe.calc_ut(jd, pid, flags)
        planets[name] = {"longitude":norm(xx[0]), "latitude":xx[1], "speed":xx[3]}
    # Mean node is used here; the engine labels the choice explicitly.
    node_x, _ = swe.calc_ut(jd, swe.MEAN_NODE, flags)
    node_lon = norm(node_x[0])
    planets["Rahu"] = {"longitude":node_lon, "latitude":node_x[1], "speed":node_x[3]}
    planets["Ketu"] = {"longitude":norm(node_lon+180.0), "latitude":-node_x[1], "speed":node_x[3]}

    lat = float(inp["latitude"]); lon = float(inp["longitude"])
    # Houses are calculated in tropical coordinates by swe_houses_ex; use ascendant
    # from the returned house structure, then subtract Lahiri ayanamsha.
    cusps, ascmc = swe.houses_ex(jd, lat, lon, b'P', swe.FLG_SIDEREAL)
    asc = norm(ascmc[0])

    return {
        "julianDay":jd,
        "ayanamsa":swe.get_ayanamsa_ut(jd),
        "nodeMode":"mean",
        "planets":planets,
        "houses":{"ascendant":asc, "mc":norm(ascmc[1]), "cusps":[norm(x) for x in cusps]}
    }

for line in sys.stdin:
    line=line.strip()
    if not line: continue
    try:
        print(json.dumps(main(json.loads(line)), separators=(",",":")), flush=True)
    except Exception as e:
        print(json.dumps({"error":str(e)}), flush=True)
