// 4D HYSPLIT Backward Dispersion Models on a Georeferenced 3D Earth.
// Maps real B2SAP binary `cdump` / NetCDF footprints (lat, lon, alt_km, backward_age_h, weight)
// onto the unit sphere with Natural Earth 110m coastlines and backward-time color encoding.

import { HYSPLIT_RUNS } from './hysplit_data.js';
import { COASTLINE_SEGMENTS } from './coastlines.js';

export const R_EARTH = 0.72;
export const ALT_MAX_KM = 30.0;
export const ALT_SPAN = 0.19; // 0..30 km maps to r = 0.72 .. 0.91 (<= 0.921 unit globe bound)

/** Convert geodetic (latDeg, lonDeg, altKm) to right-handed 3D globe coordinates. */
export function latLonAltToVec3(latDeg, lonDeg, altKm = 0) {
  const r = R_EARTH + (Math.max(0, altKm) / ALT_MAX_KM) * ALT_SPAN;
  const phi = (latDeg * Math.PI) / 180;
  const lam = (lonDeg * Math.PI) / 180;
  const cp = Math.cos(phi);
  return [
    r * cp * Math.sin(lam),
    r * Math.sin(phi),
    r * cp * Math.cos(lam),
  ];
}

/** Build 3D GL_LINES vertex array for Natural Earth 110m coastlines on sphere of radius r. */
export function buildCoastlineVertices(r = R_EARTH * 1.002) {
  const segs = COASTLINE_SEGMENTS;
  const nSeg = segs.length >> 2;
  const out = new Float32Array(nSeg * 6);
  const d2r = Math.PI / 180;
  for (let i = 0; i < nSeg; i++) {
    const j = i * 4, o = i * 6;
    const phi1 = segs[j] * d2r, lam1 = segs[j + 1] * d2r;
    const phi2 = segs[j + 2] * d2r, lam2 = segs[j + 3] * d2r;
    const cp1 = Math.cos(phi1), cp2 = Math.cos(phi2);
    out[o]     = r * cp1 * Math.sin(lam1);
    out[o + 1] = r * Math.sin(phi1);
    out[o + 2] = r * cp1 * Math.cos(lam1);
    out[o + 3] = r * cp2 * Math.sin(lam2);
    out[o + 4] = r * Math.sin(phi2);
    out[o + 5] = r * cp2 * Math.cos(lam2);
  }
  return out;
}

/**
 * Perceptual 5-stop scientific colormap for backward travel time (0h at receptor -> -336h / 14 days).
 *   0h   (u=0.00): Bright White-Gold   [1.00, 0.96, 0.55]
 *  -48h  (u=0.14): Fiery Orange-Coral  [1.00, 0.48, 0.14]
 *  -120h (u=0.36): Electric Magenta    [0.95, 0.20, 0.65]
 *  -216h (u=0.64): Deep Violet-Indigo  [0.52, 0.30, 1.00]
 *  -336h (u=1.00): Glowing Ice-Cyan    [0.12, 0.90, 1.00]
 */
const TIME_STOPS = [
  [0.00, [1.00, 0.96, 0.55]],
  [0.14, [1.00, 0.48, 0.14]],
  [0.36, [0.95, 0.20, 0.65]],
  [0.64, [0.52, 0.30, 1.00]],
  [1.00, [0.12, 0.90, 1.00]],
];

export function timeToRgb(ageHours, maxHours = 336.0) {
  const u = Math.max(0, Math.min(1, ageHours / Math.max(1, maxHours)));
  for (let i = 0; i < TIME_STOPS.length - 1; i++) {
    const [u0, c0] = TIME_STOPS[i];
    const [u1, c1] = TIME_STOPS[i + 1];
    if (u <= u1 || i === TIME_STOPS.length - 2) {
      const t = Math.max(0, Math.min(1, (u - u0) / (u1 - u0)));
      return [
        c0[0] + (c1[0] - c0[0]) * t,
        c0[1] + (c1[1] - c0[1]) * t,
        c0[2] + (c1[2] - c0[2]) * t,
      ];
    }
  }
  return TIME_STOPS[TIME_STOPS.length - 1][1];
}

function formatLatLon(lat, lon) {
  const ns = lat >= 0 ? `${lat.toFixed(1)}°N` : `${(-lat).toFixed(1)}°S`;
  const ew = lon >= 0 ? `${lon.toFixed(1)}°E` : `${(-lon).toFixed(1)}°W`;
  return `${ns}, ${ew}`;
}

export const HYSPLIT_MODELS = [
  {
    name: 'B2SAP Global Network (6 Sites)',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.35, 0.85, 1.0],
    tilt: 15,
    viewYaw: (65 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'multi_receptor',
    runs: ['boulder_12km', 'hilo_19km', 'lareunion_28km', 'lauder_17km', 'utqiagvik_19km', 'scott_base_24km'],
    fact: 'Simultaneous 14-day (-336h) 4D HYSPLIT backward dispersion from 6 global B2SAP balloon sites. Color = backward travel time; point at any receptor to isolate its plume.',
  },
  {
    name: 'Boulder Profile (12–27 km)',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [1.0, 0.65, 0.25],
    tilt: 24,
    viewYaw: (105 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'multi_receptor',
    runs: ['boulder_prof_12km', 'boulder_prof_15km', 'boulder_prof_18km', 'boulder_prof_22km', 'boulder_prof_27km'],
    fact: 'Vertical balloon ascent over Boulder, USA (12, 15, 18, 22, 27 km MSL). Reveals how air masses arriving in the same column trace back to different latitudes and wind regimes.',
  },
  {
    name: 'Boulder 12 km — UTLS Jet',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [1.0, 0.78, 0.32],
    tilt: 24,
    viewYaw: (115 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['boulder_12km'],
    fact: 'Receptor at 39.94°N, 104.97°W, 12.0 km MSL (2025-01-16). Fast mid-latitude UTLS westerly jet transport across the North Pacific and Eurasia over 14 days.',
  },
  {
    name: 'Hilo, Hawaii 19 km — Pacific Pipe',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.95, 0.42, 0.78],
    tilt: 14,
    viewYaw: (145 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['hilo_19km'],
    fact: 'Receptor at 19.78°N, 155.44°W, 19.3 km MSL (2023-09-20). Subtropical lower-stratospheric transport across the tropical Pacific and Southeast Asia.',
  },
  {
    name: 'La Réunion 28 km — Tropical Pipe',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.58, 0.42, 1.0],
    tilt: -14,
    viewYaw: (-55 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['lareunion_28km'],
    fact: 'Receptor at 21.14°S, 55.49°E, 28.0 km MSL (2022-03-31). Deep tropical/subtropical stratospheric zonal band circling the Southern Indian Ocean and Africa.',
  },
  {
    name: 'Lauder, NZ 17 km — Southern Wave',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.2, 0.88, 1.0],
    tilt: -26,
    viewYaw: (-170 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['lauder_17km'],
    fact: 'Receptor at 44.78°S, 169.93°E, 17.4 km MSL (2022-05-26). Circumpolar Southern Hemisphere Rossby wave train sweeping across the Southern Ocean and Australia.',
  },
  {
    name: 'Utqiaġvik 19 km — Arctic Vortex',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.35, 0.95, 0.85],
    tilt: 38,
    viewYaw: (155 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['utqiagvik_19km'],
    fact: 'Receptor at 71.28°N, 155.94°W, 19.3 km MSL (2023-03-15). High-latitude Arctic stratospheric polar vortex circulation crossing the North Pole and Siberia.',
  },
  {
    name: 'Scott Base 24 km — Antarctic Vortex',
    kind: 'hysplit',
    isGeo: true,
    category: 'HYSPLIT 4D',
    color: [0.45, 0.72, 1.0],
    tilt: -40,
    viewYaw: (-172 * Math.PI) / 180,
    maxAgeHours: 336,
    mode: 'single_receptor',
    runs: ['scott_base_24km'],
    fact: 'Receptor at 78.49°S, 172.87°E, 24.3 km MSL (2023-10-15). Austral spring Antarctic stratospheric polar vortex locked tightly around the South Pole.',
  },
];

const SINGLE_TIME_WINDOWS = [
  { lo: 0,   hi: 24,  label: 'Day 0–1 (0 to -24h)',     stage: 0.04 },
  { lo: 24,  hi: 72,  label: 'Days 2–3 (-24 to -72h)',   stage: 0.16 },
  { lo: 72,  hi: 144, label: 'Days 4–6 (-72 to -144h)',  stage: 0.34 },
  { lo: 144, hi: 240, label: 'Days 7–10 (-144 to -240h)', stage: 0.56 },
  { lo: 240, hi: 999, label: 'Days 11–14 (-240 to -336h)', stage: 0.78 },
];

/**
 * Build GPU buffers for a HYSPLIT 4D model with `n` particles:
 *  - ~10% of particles form the glowing 3D Earth coastlines (fixed on globe, offset = 0)
 *  - ~2% of particles form glowing Receptor beacon stars & vertical sondes (fixed at receptor)
 *  - ~88% of particles form the 4D backward dispersion plume:
 *      * target = 3D receptor coordinate (where particle sits at t = 0h / explode = 0)
 *      * offset.xyz = 3D displacement to (lat, lon, alt) at backward time -age_h
 *      * offset.w = normalized backward time stage (0..0.82) so opening hand unfolds time!
 *      * tint = RGB from backward travel time (0h white-gold -> -336h ice-cyan)
 */
export function buildHysplitModel(index, def, n, rng) {
  const t0 = performance.now();
  const rand = typeof rng === 'function' ? rng : rng.random;
  const target = new Float32Array(n * 3);
  const offset = new Float32Array(n * 4);
  const tint = new Float32Array(n * 3);
  const pick = new Float32Array(n).fill(-1);

  const nCoast = Math.floor(n * 0.10);
  const nBeaconTotal = Math.floor(n * 0.02);
  const nPlumeTotal = n - nCoast - nBeaconTotal;

  let cursor = 0;

  // 1. Sample 3D Earth coastline shimmer particles (unpickable background reference)
  const nSeg = COASTLINE_SEGMENTS.length >> 2;
  for (let i = 0; i < nCoast; i++) {
    const si = Math.floor(rand() * nSeg) * 4;
    const f = rand();
    const lat = COASTLINE_SEGMENTS[si] + (COASTLINE_SEGMENTS[si + 2] - COASTLINE_SEGMENTS[si]) * f;
    const lon = COASTLINE_SEGMENTS[si + 1] + (COASTLINE_SEGMENTS[si + 3] - COASTLINE_SEGMENTS[si + 1]) * f;
    const p = latLonAltToVec3(lat, lon, 0);
    const j = cursor * 3, o = cursor * 4;
    target[j] = p[0]; target[j + 1] = p[1]; target[j + 2] = p[2];
    offset[o] = 0; offset[o + 1] = 0; offset[o + 2] = 0; offset[o + 3] = 0;
    tint[j] = 0.12; tint[j + 1] = 0.45; tint[j + 2] = 0.65;
    pick[cursor] = -1;
    cursor++;
  }

  const runs = def.runs.map((k) => HYSPLIT_RUNS[k]).filter(Boolean);
  const isMulti = def.mode === 'multi_receptor';
  const maxAge = def.maxAgeHours || 336;

  // Group stats for interactive 3D labels & picking
  const nGroups = isMulti ? runs.length : SINGLE_TIME_WINDOWS.length;
  const groupStats = Array.from({ length: nGroups }, () => ({
    recPos: [0, 0, 0],
    sumPlume: [0, 0, 0],
    sumLat: 0,
    sumLonSin: 0,
    sumLonCos: 0,
    sumAlt: 0,
    sumAge: 0,
    count: 0,
  }));

  // 2. Sample Receptor beacon stars + vertical atmospheric sonde lines
  const beaconPerRun = Math.max(1, Math.floor(nBeaconTotal / runs.length));
  runs.forEach((run, ri) => {
    const rec = run.receptor;
    const recPos = latLonAltToVec3(rec.lat, rec.lon, rec.alt_km);
    const gIdx = isMulti ? ri : 0;
    groupStats[gIdx].recPos = recPos;
    const count = ri === runs.length - 1 ? (nCoast + nBeaconTotal - cursor) : beaconPerRun;
    for (let k = 0; k < count && cursor < nCoast + nBeaconTotal; k++) {
      let p;
      if (k < count * 0.35) {
        // Vertical sonde column from ground (0 km) to receptor altitude
        const f = rand();
        p = latLonAltToVec3(rec.lat, rec.lon, rec.alt_km * f);
      } else {
        // Glowing star cluster right at the receptor
        const jLat = (rand() - 0.5) * 0.5;
        const jLon = (rand() - 0.5) * 0.5;
        const jAlt = (rand() - 0.5) * 0.6;
        p = latLonAltToVec3(rec.lat + jLat, rec.lon + jLon, rec.alt_km + jAlt);
      }
      const j = cursor * 3, o = cursor * 4;
      target[j] = p[0]; target[j + 1] = p[1]; target[j + 2] = p[2];
      offset[o] = 0; offset[o + 1] = 0; offset[o + 2] = 0; offset[o + 3] = 0;
      tint[j] = 1.0; tint[j + 1] = 0.97; tint[j + 2] = 0.78;
      pick[cursor] = gIdx;
      cursor++;
    }
  });

  // 3. Sample 4D Backward Plume particles weighted by concentration sensitivity
  const plumePerRun = Math.floor(nPlumeTotal / runs.length);
  runs.forEach((run, ri) => {
    const rec = run.receptor;
    const recPos = latLonAltToVec3(rec.lat, rec.lon, rec.alt_km);
    const lats = run.lat, lons = run.lon, alts = run.alt_km, ages = run.age_h, weights = run.weight;
    const nVox = lats.length;

    // Build cumulative distribution from voxel weights
    const cdf = new Float64Array(nVox);
    let totalW = 0;
    for (let v = 0; v < nVox; v++) {
      totalW += weights[v];
      cdf[v] = totalW;
    }

    const myCount = ri === runs.length - 1 ? (n - cursor) : plumePerRun;
    for (let k = 0; k < myCount && cursor < n; k++) {
      // Binary search in CDF
      const rVal = rand() * totalW;
      let lo = 0, hi = nVox - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] < rVal) lo = mid + 1;
        else hi = mid;
      }

      // Sub-grid 4D jitter within the HYSPLIT (0.25° x 0.25° x 1 km x 1h) voxel
      const lat = Math.max(-89.8, Math.min(89.8, lats[lo] + (rand() - 0.5) * 0.32));
      const lon = lons[lo] + (rand() - 0.5) * 0.32;
      const alt = Math.max(0.1, alts[lo] + (rand() - 0.5) * 0.9);
      const age = Math.max(0.1, Math.min(maxAge, ages[lo] + (rand() - 0.5) * 1.2));

      const pPlume = latLonAltToVec3(lat, lon, alt);
      const stage = Math.min(0.82, (age / maxAge) * 0.82);
      const col = timeToRgb(age, maxAge);

      let gIdx = 0;
      if (isMulti) {
        gIdx = ri;
      } else {
        for (let w = 0; w < SINGLE_TIME_WINDOWS.length; w++) {
          if (age >= SINGLE_TIME_WINDOWS[w].lo && age < SINGLE_TIME_WINDOWS[w].hi) {
            gIdx = w;
            break;
          }
        }
      }

      const j = cursor * 3, o = cursor * 4;
      // At u_explode = 0 (Fist / 0h), particle sits at its Receptor (`recPos`).
      // As u_explode -> 1 (Open Hand / -336h), particle travels to `pPlume`!
      target[j]     = recPos[0];
      target[j + 1] = recPos[1];
      target[j + 2] = recPos[2];
      offset[o]     = pPlume[0] - recPos[0];
      offset[o + 1] = pPlume[1] - recPos[1];
      offset[o + 2] = pPlume[2] - recPos[2];
      offset[o + 3] = stage;
      tint[j]       = col[0];
      tint[j + 1]   = col[1];
      tint[j + 2]   = col[2];
      pick[cursor]  = gIdx;

      const st = groupStats[gIdx];
      st.recPos = recPos;
      st.sumPlume[0] += pPlume[0];
      st.sumPlume[1] += pPlume[1];
      st.sumPlume[2] += pPlume[2];
      st.sumLat += lat;
      const lonRad = (lon * Math.PI) / 180;
      st.sumLonSin += Math.sin(lonRad);
      st.sumLonCos += Math.cos(lonRad);
      st.sumAlt += alt;
      st.sumAge += age;
      st.count++;

      cursor++;
    }
  });

  // 4. Build interactive 3D labels
  const labels = [];
  if (isMulti) {
    runs.forEach((run, ri) => {
      const st = groupStats[ri];
      const c = Math.max(1, st.count);
      const rec = run.receptor;
      const recPos = latLonAltToVec3(rec.lat, rec.lon, rec.alt_km);
      const meanPlume = st.count > 0
        ? [st.sumPlume[0] / c, st.sumPlume[1] / c, st.sumPlume[2] / c]
        : recPos;
      // Anchor the receptor label near the receptor (slightly toward the plume centroid when exploded)
      const anchorOffset = [
        (meanPlume[0] - recPos[0]) * 0.25,
        (meanPlume[1] - recPos[1]) * 0.25,
        (meanPlume[2] - recPos[2]) * 0.25,
      ];
      const meanAlt = (st.sumAlt / c).toFixed(1);
      labels.push({
        label: run.site,
        info: `${formatLatLon(rec.lat, rec.lon)} · Rec ${rec.alt_km.toFixed(1)} km · Mean plume ${meanAlt} km (${rec.release_date})`,
        color: timeToRgb((ri / Math.max(1, runs.length - 1)) * maxAge * 0.85, maxAge),
        count: st.count,
        stage: 0.05,
        centroid: recPos,
        offset: anchorOffset,
      });
    });
  } else {
    const run = runs[0];
    const rec = run.receptor;
    const recPos = latLonAltToVec3(rec.lat, rec.lon, rec.alt_km);
    SINGLE_TIME_WINDOWS.forEach((win, wi) => {
      const st = groupStats[wi];
      if (st.count === 0) return;
      const c = st.count;
      const meanPlume = [st.sumPlume[0] / c, st.sumPlume[1] / c, st.sumPlume[2] / c];
      // Project meanPlume onto the shell so the label sits cleanly on the plume centerline
      const meanLat = st.sumLat / c;
      const meanLon = (Math.atan2(st.sumLonSin / c, st.sumLonCos / c) * 180) / Math.PI;
      const meanAlt = st.sumAlt / c;
      const meanAge = st.sumAge / c;
      const shellAnchor = latLonAltToVec3(meanLat, meanLon, meanAlt);
      const blendAnchor = [
        0.5 * meanPlume[0] + 0.5 * shellAnchor[0],
        0.5 * meanPlume[1] + 0.5 * shellAnchor[1],
        0.5 * meanPlume[2] + 0.5 * shellAnchor[2],
      ];
      labels.push({
        label: wi === 0 ? `Receptor: ${run.short} (0 to -24h)` : win.label,
        info: `Mean ${formatLatLon(meanLat, meanLon)} · Alt ${meanAlt.toFixed(1)} km MSL · Age -${meanAge.toFixed(0)}h`,
        color: timeToRgb(meanAge, maxAge),
        count: st.count,
        stage: win.stage,
        centroid: recPos,
        offset: [
          blendAnchor[0] - recPos[0],
          blendAnchor[1] - recPos[1],
          blendAnchor[2] - recPos[2],
        ],
      });
    });
  }

  return {
    index,
    def,
    n,
    target,
    offset,
    tint,
    pick,
    labels,
    groups: labels.map((l) => l.label),
    fitScale: 1.0,           // Keep Earth radius constant during backward-time unfolding!
    exCenter: [0, 0, 0],     // Keep Earth center locked at origin [0,0,0]!
    ms: performance.now() - t0,
  };
}
