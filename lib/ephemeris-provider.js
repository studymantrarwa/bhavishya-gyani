/*
  Production Swiss Ephemeris provider.

  V30 used a Node -> HTTP -> Python round trip for Swiss Ephemeris. On the
  deployed site that Python function can fail before its handler runs, which
  then surfaced in the browser as the unhelpful "[object Object]" message.

  V31 keeps the calculation inside the Node.js Vercel function using the
  native @swisseph/node binding. The package ships prebuilt binaries and
  bundled Swiss Ephemeris data, so no separate Python function or internal
  HTTP call is required.
*/
const fallback = require('./ephemeris-provider-fallback');

const PLANETS = [
  ['Sun', 'Sun'],
  ['Moon', 'Moon'],
  ['Mars', 'Mars'],
  ['Mercury', 'Mercury'],
  ['Jupiter', 'Jupiter'],
  ['Venus', 'Venus'],
  ['Saturn', 'Saturn'],
];

const norm = x => ((Number(x) % 360) + 360) % 360;

function loadSwiss() {
  // Keep the require lazy so non-Kundli routes do not load the native addon.
  // eslint-disable-next-line global-require
  return require('@swisseph/node');
}

function birthJulianDay(swe, input) {
  const [y, m, d] = String(input.dob).split('-').map(Number);
  if (![y, m, d].every(Number.isFinite)) throw new Error('Invalid birth date');

  const parts = String(input.time || '12:00').split(':').map(Number);
  const hh = Number.isFinite(parts[0]) ? parts[0] : 0;
  const mm = Number.isFinite(parts[1]) ? parts[1] : 0;
  const ss = Number.isFinite(parts[2]) ? parts[2] : 0;
  const timezone = Number(input.timezone ?? input.tzOffset ?? 5.5);
  if (!Number.isFinite(timezone)) throw new Error('Invalid timezone');

  const utcHours = hh + mm / 60 + ss / 3600 - timezone;
  return swe.julianDay(y, m, d, utcHours);
}

function siderealHouses(tropicalHouses, ayanamsa) {
  const cusps = Array.from({ length: 13 }, (_, i) => {
    if (i === 0) return 0;
    return norm(Number(tropicalHouses.cusps[i]) - ayanamsa);
  });
  return {
    ascendant: norm(Number(tropicalHouses.ascendant) - ayanamsa),
    mc: norm(Number(tropicalHouses.mc) - ayanamsa),
    cusps,
  };
}

function calculateSwiss(input) {
  const swe = loadSwiss();
  const {
    CalculationFlag,
    Planet,
    LunarPoint,
    HouseSystem,
    SiderealMode,
    setSiderealMode,
    getAyanamsaExUt,
    julianDay,
    calculatePosition,
    calculateHouses,
  } = swe;

  if (!CalculationFlag || !Planet || !LunarPoint || !HouseSystem || !SiderealMode) {
    throw new Error('Swiss Ephemeris Node package API is incomplete');
  }

  setSiderealMode(SiderealMode.Lahiri);

  const jd = birthJulianDay(swe, input);
  const flags = CalculationFlag.SwissEphemeris |
    CalculationFlag.Speed |
    CalculationFlag.Sidereal;

  // calculatePosition accepts Julian UT directly. The explicit sidereal flag
  // plus Lahiri mode keeps the planetary longitudes on the requested Vedic
  // sidereal/Lahiri reference frame.
  const planets = {};
  for (const [name, enumName] of PLANETS) {
    const p = calculatePosition(jd, Planet[enumName], flags);
    planets[name] = {
      longitude: norm(p.longitude),
      latitude: Number(p.latitude || 0),
      speed: Number(p.longitudeSpeed || 0),
    };
  }

  const node = calculatePosition(jd, LunarPoint.MeanNode, flags);
  planets.Rahu = {
    longitude: norm(node.longitude),
    latitude: Number(node.latitude || 0),
    speed: Number(node.longitudeSpeed || 0),
  };
  planets.Ketu = {
    longitude: norm(node.longitude + 180),
    latitude: -Number(node.latitude || 0),
    speed: Number(node.longitudeSpeed || 0),
  };

  // The Node wrapper's calculateHouses() exposes the standard tropical house
  // calculation. Convert the cusps/angles to sidereal by subtracting the same
  // Lahiri ayanamsa used by the planetary calculations.
  const tropicalHouses = calculateHouses(
    jd,
    Number(input.latitude),
    Number(input.longitude),
    HouseSystem.Placidus,
  );
  const ayanamsa = Number(getAyanamsaExUt(jd, CalculationFlag.SwissEphemeris));
  const houses = siderealHouses(tropicalHouses, ayanamsa);

  // Keep this referenced for package API compatibility checks in deployments.
  if (typeof julianDay !== 'function') throw new Error('Swiss Ephemeris julianDay API unavailable');

  return {
    julianDay: jd,
    ayanamsa,
    nodeMode: 'mean',
    planets,
    houses,
    provider: 'swiss-ephemeris-node',
    fallback: false,
  };
}

function stringifyError(err) {
  if (!err) return 'Unknown Swiss Ephemeris error';
  if (typeof err === 'string') return err;
  if (err.message) return String(err.message);
  try { return JSON.stringify(err); } catch { return String(err); }
}

async function calculateEphemeris(input) {
  try {
    return calculateSwiss(input);
  } catch (err) {
    const message = stringifyError(err);
    if (process.env.VERCEL) {
      const e = new Error(`Swiss Ephemeris production calculation failed: ${message}`);
      e.code = 'EPHEMERIS_REQUIRED';
      throw e;
    }
    const x = fallback.calculateFallback(input);
    x.fallback = true;
    x.providerError = message;
    return x;
  }
}

module.exports = { calculateEphemeris };
