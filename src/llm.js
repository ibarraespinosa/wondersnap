// Instant zero-latency (<0.1 ms) Keyword, Gazetteer & Coordinate Controller for HYSPLIT 4D Earth.
// Zero GPU overhead so particles and hand tracking run at full 60 FPS.

export const QUICK_REGIONS = [
  { id: 'arctic',     btn: '🧭 Arctic',     lat: 80.0,  lon: -105.0, label: 'Arctic (80°N, 105°W)' },
  { id: 'panama',     btn: '🌎 Panama',     lat: 9.0,   lon: -80.0,  label: 'Panama (9°N, 80°W)' },
  { id: 'antarctica', btn: '🧊 Antarctica', lat: -82.0, lon: 170.0,  label: 'Antarctica (82°S, 170°E)' },
  { id: 'boulder',    btn: '🏔️ Boulder',    lat: 40.0,  lon: -105.0, label: 'Boulder, USA (40°N, 105°W)' },
  { id: 'hilo',       btn: '🌋 Hawaii',     lat: 19.8,  lon: -155.4, label: 'Hilo, Hawaii (19.8°N, 155.4°W)' },
  { id: 'reunion',    btn: '🏝️ La Réunion', lat: -21.1, lon: 55.5,   label: 'La Réunion (21.1°S, 55.5°E)' },
  { id: 'lauder',     btn: '🌊 New Zealand',lat: -44.8, lon: 169.9,  label: 'Lauder, NZ (44.8°S, 169.9°E)' },
];

export const GAZETTEER = [
  { keys: ['panama', 'central america', 'caribbean', 'center', 'centre'], lat: 9.0, lon: -80.0, label: 'Panama (9°N, 80°W)' },
  { keys: ['arctic', 'artic', 'north pole', 'high north', 'polar north', 'north'], lat: 80.0, lon: -105.0, label: 'Arctic (80°N, 105°W)' },
  { keys: ['antarctica', 'antarctic', 'antartic', 'antartica', 'south pole', 'polar south', 'south'], lat: -82.0, lon: 170.0, label: 'Antarctica (82°S, 170°E)' },
  { keys: ['utqiagvik', 'barrow', 'alaska'], lat: 71.3, lon: -155.9, label: 'Utqiaġvik, Alaska (71.3°N, 155.9°W)' },
  { keys: ['scott base', 'mcmurdo', 'ross sea'], lat: -78.5, lon: 172.9, label: 'Scott Base (78.5°S, 172.9°E)' },
  { keys: ['boulder', 'colorado', 'rockies', 'denver'], lat: 40.0, lon: -105.0, label: 'Boulder, USA (40.0°N, 105.0°W)' },
  { keys: ['hilo', 'hawaii', 'mauna loa'], lat: 19.8, lon: -155.4, label: 'Hilo, Hawaii (19.8°N, 155.4°W)' },
  { keys: ['reunion', 'la reunion', 'madagascar', 'indian ocean'], lat: -21.1, lon: 55.5, label: 'La Réunion (21.1°S, 55.5°E)' },
  { keys: ['lauder', 'new zealand', 'southern ocean', 'tasman'], lat: -44.8, lon: 169.9, label: 'Lauder, NZ (44.8°S, 169.9°E)' },
  { keys: ['north america', 'united states', 'usa', 'canada', 'mexico'], lat: 38.0, lon: -100.0, label: 'North America (38°N, 100°W)' },
  { keys: ['south america', 'brazil', 'amazon', 'andes', 'chile', 'argentina', 'peru', 'colombia', 'suriname', 'paramaribo'], lat: -15.0, lon: -60.0, label: 'South America (15°S, 60°W)' },
  { keys: ['costa rica', 'san pedro'], lat: 9.9, lon: -84.1, label: 'Costa Rica (9.9°N, 84.1°W)' },
  { keys: ['europe', 'uk', 'france', 'germany', 'spain', 'italy'], lat: 48.0, lon: 10.0, label: 'Europe (48°N, 10°E)' },
  { keys: ['africa', 'sahara', 'congo', 'south africa'], lat: 5.0, lon: 20.0, label: 'Africa (5°N, 20°E)' },
  { keys: ['asia', 'china', 'japan', 'india', 'siberia', 'himalayas', 'eurasia'], lat: 38.0, lon: 100.0, label: 'Asia (38°N, 100°E)' },
  { keys: ['australia', 'sydney', 'melbourne'], lat: -25.0, lon: 135.0, label: 'Australia (25°S, 135°E)' },
  { keys: ['pacific', 'pacific ocean'], lat: 10.0, lon: -160.0, label: 'Pacific Ocean (10°N, 160°W)' },
  { keys: ['atlantic', 'atlantic ocean'], lat: 20.0, lon: -40.0, label: 'Atlantic Ocean (20°N, 40°W)' },
  { keys: ['equator', 'tropics', 'tropical'], lat: 0.0, lon: -80.0, label: 'Equator (0°, 80°W)' },
];

/**
 * Instant (<0.1 ms) keyword & coordinate parser.
 */
export function parseNaturalVisualCommand(text, catalog, labels = []) {
  const raw = String(text || '').trim();
  const low = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = ` ${low.replace(/[^a-z0-9.+-]+/g, ' ')} `;
  const has = (...phrases) => phrases.some((p) => clean.includes(` ${p} `));
  const actions = [];

  if (has('reset', 'recet', 'default', 'home')) {
    actions.push({ type: 'resetView' });
  }

  // 1. Model switching
  if (has('global network', 'all sites', 'six sites', '6 sites', 'network', 'all receptors')) {
    actions.push({ type: 'model', name: 'B2SAP Global Network (6 Sites)' });
  } else if (has('profile', 'vertical profile', 'curtain', 'all altitudes')) {
    actions.push({ type: 'model', name: 'Boulder Profile (12–27 km)' });
  } else if (has('boulder 12', 'utls', 'jet stream')) {
    actions.push({ type: 'model', name: 'Boulder 12 km — UTLS Jet' });
  } else if (has('hilo 19', 'pacific pipe')) {
    actions.push({ type: 'model', name: 'Hilo, Hawaii 19 km — Pacific Pipe' });
  } else if (has('reunion 28', 'tropical pipe')) {
    actions.push({ type: 'model', name: 'La Réunion 28 km — Tropical Pipe' });
  } else if (has('lauder 17', 'southern wave')) {
    actions.push({ type: 'model', name: 'Lauder, NZ 17 km — Southern Wave' });
  } else if (has('utqiagvik 19', 'arctic vortex')) {
    actions.push({ type: 'model', name: 'Utqiaġvik 19 km — Arctic Vortex' });
  } else if (has('scott base 24', 'antarctic vortex')) {
    actions.push({ type: 'model', name: 'Scott Base 24 km — Antarctic Vortex' });
  }

  // 2. Part / Receptor / Altitude selection
  const altMatch = low.match(/\b(12|15|17|18|19|22|24|27|28)\s*(km|kilometers?)\b/);
  if (altMatch && labels.length) {
    const km = altMatch[1];
    const idx = labels.findIndex((l) => l.label.toLowerCase().includes(`${km}`) || l.info?.toLowerCase().includes(`${km}`));
    if (idx >= 0) actions.push({ type: 'part', index: idx });
  }

  if (has('show all', 'clear', 'deselect', 'unselect', 'all particles')) {
    actions.push({ type: 'deselect' });
  }

  // 3. Coordinates ("20N 100W" or "-21, 55") or Gazetteer keyword ("panama", "arctic", "antarctica", etc.)
  const coordMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:deg|degrees|°)?\s*([ns])\s*[, ]+\s*(\d+(?:\.\d+)?)\s*(?:deg|degrees|°)?\s*([ew])/i);
  const pairMatch = !coordMatch && low.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]) * (coordMatch[2].toLowerCase() === 's' ? -1 : 1);
    const lon = parseFloat(coordMatch[3]) * (coordMatch[4].toLowerCase() === 'w' ? -1 : 1);
    actions.push({ type: 'focusGeo', lat, lon, label: `${lat.toFixed(1)}°, ${lon.toFixed(1)}°` });
  } else if (pairMatch) {
    const lat = parseFloat(pairMatch[1]), lon = parseFloat(pairMatch[2]);
    actions.push({ type: 'focusGeo', lat, lon, label: `${lat.toFixed(1)}°, ${lon.toFixed(1)}°` });
  } else {
    for (const g of GAZETTEER) {
      if (g.keys.some((k) => clean.includes(` ${k} `))) {
        actions.push({ type: 'focusGeo', lat: g.lat, lon: g.lon, label: g.label });
        break;
      }
    }
  }

  // 4. Backward Time scrubbing
  const hoursMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/);
  const daysMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:d|days?)\b/);
  if (hoursMatch) {
    actions.push({ type: 'setBacktrackHours', hours: Math.min(336, Math.max(0, parseFloat(hoursMatch[1]))) });
  } else if (daysMatch) {
    actions.push({ type: 'setBacktrackHours', hours: Math.min(336, Math.max(0, parseFloat(daysMatch[1]) * 24)) });
  } else if (has('receptor', 'at receptor', 'collapse', 'zero')) {
    actions.push({ type: 'setBacktrackHours', hours: 0 });
  } else if (has('full', '14 days', 'unfold', 'all time')) {
    actions.push({ type: 'setBacktrackHours', hours: 336 });
  }

  // 5. Camera & visual toggles
  if (has('stop', 'freeze', 'pause', 'hold')) actions.push({ type: 'setAutoRotate', on: false });
  else if (has('spin', 'rotate')) actions.push({ type: 'setAutoRotate', on: true });
  if (has('zoom in', 'closer', 'bigger')) actions.push({ type: 'zoomIn' });
  if (has('zoom out', 'farther', 'further', 'smaller')) actions.push({ type: 'zoomOut' });
  if (has('slice', 'cross section', 'cut')) actions.push({ type: 'cut' });

  return actions;
}
