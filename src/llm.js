// In-browser AI Visual Director & HYSPLIT Co-Pilot:
// Combines an instant semantic/gazetteer NLU parser (<1 ms) with WebGPU open-weights LLMs
// (@mlc-ai/web-llm: Qwen3.5-0.8B, Qwen3-1.7B, Llama-3.2-1B, Qwen2.5-1.5B) running 100% in the browser.

export const WEBLLM_MODELS = [
  { id: 'Qwen3.5-0.8B-q4f16_1-MLC', name: 'Qwen 3.5 (0.8B · Fast)', size: '~500 MB' },
  { id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC', name: 'Llama 3.2 (1B · Balanced)', size: '~650 MB' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', name: 'Qwen 2.5 (1.5B · Smart)', size: '~950 MB' },
  { id: 'Qwen3-1.7B-q4f16_1-MLC', name: 'Qwen 3 (1.7B · Deep)', size: '~1.1 GB' },
];

/** Global geographic gazetteer for natural-language globe centering ("focus on Panama", "take me to the Arctic", etc.) */
export const GAZETTEER = [
  { keys: ['panama', 'central america', 'caribbean', 'center', 'centre'], lat: 9.0, lon: -80.0, label: 'Panama / Central America (9°N, 80°W)' },
  { keys: ['arctic', 'north pole', 'high north', 'polar north', 'boreal'], lat: 80.0, lon: -105.0, label: 'Arctic / North Pole (80°N, 105°W)' },
  { keys: ['antarctica', 'antarctic', 'south pole', 'polar south'], lat: -82.0, lon: 170.0, label: 'Antarctica / South Pole (82°S, 170°E)' },
  { keys: ['utqiagvik', 'barrow', 'alaska'], lat: 71.3, lon: -155.9, label: 'Utqiaġvik, Alaska (71.3°N, 155.9°W)' },
  { keys: ['scott base', 'mcmurdo', 'ross sea'], lat: -78.5, lon: 172.9, label: 'Scott Base, Antarctica (78.5°S, 172.9°E)' },
  { keys: ['boulder', 'colorado', 'rockies', 'rocky mountains', 'denver'], lat: 40.0, lon: -105.0, label: 'Boulder, Colorado (40.0°N, 105.0°W)' },
  { keys: ['hilo', 'hawaii', 'mauna loa'], lat: 19.8, lon: -155.4, label: 'Hilo, Hawaii (19.8°N, 155.4°W)' },
  { keys: ['reunion', 'la reunion', 'madagascar', 'indian ocean'], lat: -21.1, lon: 55.5, label: 'La Réunion / Indian Ocean (21.1°S, 55.5°E)' },
  { keys: ['lauder', 'new zealand', 'southern ocean', 'tasman'], lat: -44.8, lon: 169.9, label: 'Lauder, New Zealand (44.8°S, 169.9°E)' },
  { keys: ['north america', 'united states', 'usa', 'canada', 'mexico'], lat: 38.0, lon: -100.0, label: 'North America (38°N, 100°W)' },
  { keys: ['south america', 'brazil', 'amazon', 'andes', 'chile', 'argentina', 'peru', 'colombia', 'suriname', 'paramaribo'], lat: -15.0, lon: -60.0, label: 'South America (15°S, 60°W)' },
  { keys: ['costa rica', 'san pedro'], lat: 9.9, lon: -84.1, label: 'San Pedro, Costa Rica (9.9°N, 84.1°W)' },
  { keys: ['europe', 'uk', 'france', 'germany', 'spain', 'italy'], lat: 48.0, lon: 10.0, label: 'Europe (48°N, 10°E)' },
  { keys: ['africa', 'sahara', 'congo', 'south africa'], lat: 5.0, lon: 20.0, label: 'Africa (5°N, 20°E)' },
  { keys: ['asia', 'china', 'japan', 'india', 'siberia', 'himalayas', 'eurasia'], lat: 38.0, lon: 100.0, label: 'Asia (38°N, 100°E)' },
  { keys: ['australia', 'sydney', 'melbourne'], lat: -25.0, lon: 135.0, label: 'Australia (25°S, 135°E)' },
  { keys: ['pacific', 'pacific ocean'], lat: 10.0, lon: -160.0, label: 'Pacific Ocean (10°N, 160°W)' },
  { keys: ['atlantic', 'atlantic ocean'], lat: 20.0, lon: -40.0, label: 'Atlantic Ocean (20°N, 40°W)' },
  { keys: ['equator', 'tropics', 'tropical'], lat: 0.0, lon: -80.0, label: 'Equator / Tropics (0°, 80°W)' },
];

/**
 * Rich semantic NLU parser that extracts structured visual control actions from natural language
 * in < 1 ms (used both as an instant fast-path and merged with WebLLM tool calls).
 */
export function parseNaturalVisualCommand(text, catalog, labels = []) {
  const raw = String(text || '').trim();
  const low = raw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const clean = ` ${low.replace(/[^a-z0-9.+-]+/g, ' ')} `;
  const has = (...phrases) => phrases.some((p) => clean.includes(` ${p} `));
  const actions = [];

  // 1. Model switching (HYSPLIT scenarios & WonderSnap models)
  if (has('global network', 'all sites', 'six sites', '6 sites', 'network', 'all receptors')) {
    actions.push({ type: 'model', name: 'B2SAP Global Network (6 Sites)' });
  } else if (has('profile', 'vertical profile', 'curtain', 'all altitudes', 'balloon ascent')) {
    actions.push({ type: 'model', name: 'Boulder Profile (12–27 km)' });
  } else if (has('boulder 12', 'utls', 'jet stream')) {
    actions.push({ type: 'model', name: 'Boulder 12 km — UTLS Jet' });
  } else if (has('hilo 19', 'pacific pipe')) {
    actions.push({ type: 'model', name: 'Hilo, Hawaii 19 km — Pacific Pipe' });
  } else if (has('reunion 28', 'tropical pipe', 'brewer dobson')) {
    actions.push({ type: 'model', name: 'La Réunion 28 km — Tropical Pipe' });
  } else if (has('lauder 17', 'southern wave', 'rossby')) {
    actions.push({ type: 'model', name: 'Lauder, NZ 17 km — Southern Wave' });
  } else if (has('utqiagvik 19', 'arctic vortex')) {
    actions.push({ type: 'model', name: 'Utqiaġvik 19 km — Arctic Vortex' });
  } else if (has('scott base 24', 'antarctic vortex')) {
    actions.push({ type: 'model', name: 'Scott Base 24 km — Antarctic Vortex' });
  }

  // 2. Part / Receptor / Altitude / Time-Window selection on the active model
  const altMatch = low.match(/\b(12|15|17|18|19|22|24|27|28)\s*(km|kilometers?)\b/);
  if (altMatch && labels.length) {
    const km = altMatch[1];
    const idx = labels.findIndex((l) => l.label.toLowerCase().includes(`${km}`) || l.info?.toLowerCase().includes(`${km}`));
    if (idx >= 0) actions.push({ type: 'part', index: idx });
  }

  // Match label names (receptors or time windows)
  if (!actions.some((a) => a.type === 'part') && labels.length) {
    let bestIdx = -1, bestScore = 0;
    labels.forEach((L, idx) => {
      const lLow = L.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const tokens = lLow.split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !['days', 'mean', 'receptor'].includes(w));
      let s = 0;
      for (const tk of tokens) if (clean.includes(` ${tk} `)) s += tk.length;
      if (s > bestScore) { bestScore = s; bestIdx = idx; }
    });
    if (bestIdx >= 0 && (has('select', 'highlight', 'isolate', 'pick', 'only', 'receptor', 'layer') || !actions.length)) {
      actions.push({ type: 'part', index: bestIdx });
    }
  }

  if (has('show all', 'clear selection', 'deselect', 'unselect', 'everyone', 'all particles')) {
    actions.push({ type: 'deselect' });
  }

  // 3. Geographic centering ("center on Panama", "go to Antarctica", "look at 20N 100W")
  const coordMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:deg|degrees|°)?\s*([ns])\s*[, ]+\s*(\d+(?:\.\d+)?)\s*(?:deg|degrees|°)?\s*([ew])/i);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]) * (coordMatch[2].toLowerCase() === 's' ? -1 : 1);
    const lon = parseFloat(coordMatch[3]) * (coordMatch[4].toLowerCase() === 'w' ? -1 : 1);
    actions.push({ type: 'focusGeo', lat, lon, label: `Custom (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)` });
  } else {
    for (const g of GAZETTEER) {
      if (g.keys.some((k) => clean.includes(` ${k} `))) {
        // If the user only said a site name and asked to "switch to" / "load" that model, switch model too
        if (has('model', 'load', 'switch', 'open run', 'deep dive')) {
          const m = catalog.find((d) => d.kind === 'hysplit' && d.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(g.keys[0]));
          if (m && !actions.some((a) => a.type === 'model')) actions.push({ type: 'model', name: m.name });
        }
        actions.push({ type: 'focusGeo', lat: g.lat, lon: g.lon, label: g.label });
        break;
      }
    }
  }

  // 4. Backward Time / Explode scrubbing ("rewind to 3 days ago", "go back 120 hours", "at receptor", "full 14 days")
  const hoursMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hours?)\b/);
  const daysMatch = low.match(/(\d+(?:\.\d+)?)\s*(?:d|days?)\b/);
  if (hoursMatch) {
    const hrs = Math.min(336, Math.max(0, parseFloat(hoursMatch[1])));
    actions.push({ type: 'setBacktrackHours', hours: hrs });
  } else if (daysMatch) {
    const hrs = Math.min(336, Math.max(0, parseFloat(daysMatch[1]) * 24));
    actions.push({ type: 'setBacktrackHours', hours: hrs });
  } else if (has('at receptor', 'at the receptor', 'zero hours', 'collapse', 'assemble', 'converge', 'start time')) {
    actions.push({ type: 'setBacktrackHours', hours: 0 });
  } else if (has('full backtrack', 'all the way', 'full plume', '14 days', 'two weeks', 'unfold', 'explode')) {
    actions.push({ type: 'setBacktrackHours', hours: 336 });
  } else if (has('halfway', 'half way', 'one week')) {
    actions.push({ type: 'setBacktrackHours', hours: 168 });
  }

  // 5. Camera & visual toggles
  if (has('stop rotating', 'stop spinning', 'pause rotation', 'freeze', 'hold still', 'stop rotation')) {
    actions.push({ type: 'setAutoRotate', on: false });
  } else if (has('start rotating', 'start spinning', 'spin', 'auto rotate', 'rotate globe')) {
    actions.push({ type: 'setAutoRotate', on: true });
  }
  if (has('zoom in', 'closer', 'magnify', 'bigger')) actions.push({ type: 'zoomIn' });
  if (has('zoom out', 'farther', 'further', 'smaller', 'wide view')) actions.push({ type: 'zoomOut' });
  if (has('reset zoom', 'normal zoom')) actions.push({ type: 'zoomReset' });
  if (has('slice', 'cross section', 'cut away', 'cutaway', 'vertical slice')) actions.push({ type: 'cut' });
  if (has('hide labels', 'labels off', 'no labels')) actions.push({ type: 'setLabels', on: false });
  else if (has('show labels', 'labels on')) actions.push({ type: 'setLabels', on: true });
  if (has('next model', 'next run', 'next')) actions.push({ type: 'next' });
  if (has('previous model', 'previous run', 'previous')) actions.push({ type: 'prev' });

  return actions;
}

const SYSTEM_PROMPT = `You are the AI Visual Director and Atmospheric Science Co-Pilot for HYSPLIT 4D Earth (WonderSnap).
You control a 3D WebGL2 rotating Earth displaying 250,000 HYSPLIT backward-trajectory particles (-336h / 14 days) from stratospheric balloon receptors (Boulder USA, Hilo Hawaii, La Réunion, Lauder NZ, Utqiaġvik Alaska, Scott Base Antarctica).

Respond ONLY with a single valid JSON object (no markdown fences, no extra text) matching this schema:
{
  "actions": [
    // Zero or more visual commands:
    // {"type": "focusGeo", "lat": number, "lon": number, "label": "Region Name"}
    // {"type": "setBacktrackHours", "hours": number}   // 0 (at receptor) to 336 (14 days back)
    // {"type": "model", "name": "exact model name"}
    // {"type": "part", "index": number}                // 0-based index of receptor or time window to highlight
    // {"type": "deselect"}                             // show all groups
    // {"type": "zoom", "value": number}                // 0.6 to 2.5
    // {"type": "setAutoRotate", "on": boolean}
    // {"type": "cut"}                                  // toggle 3D cross-section slice
  ],
  "reply": "One short, friendly sentence (max 22 words) explaining what you just did or answering the user's scientific question."
}`;

export class WebLlmDirector {
  constructor() {
    this.engine = null;
    this.modelId = WEBLLM_MODELS[0].id;
    this.status = 'idle'; // 'idle' | 'loading' | 'ready' | 'error'
    this.progressText = '';
    this.progressPct = 0;
    this.onStatusChange = null;
  }

  notify(status, text = '', pct = 0) {
    this.status = status;
    this.progressText = text;
    this.progressPct = pct;
    this.onStatusChange?.({ status, text, pct, modelId: this.modelId });
  }

  async load(modelId = this.modelId) {
    if (this.status === 'loading') return false;
    if (this.engine && this.modelId === modelId && this.status === 'ready') return true;
    this.modelId = modelId;
    if (!navigator.gpu) {
      this.notify('error', 'WebGPU is not available in this browser (try Chrome/Edge). Built-in Smart NLU is active!', 0);
      return false;
    }
    try {
      this.notify('loading', `Loading WebLLM (${modelId.split('-q4')[0]})…`, 2);
      const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.87');
      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback: (rep) => {
          const pct = Math.round((rep.progress || 0) * 100);
          this.notify('loading', rep.text || `Loading ${pct}%…`, pct);
        },
      });
      this.notify('ready', `WebLLM Ready (${modelId.split('-q4')[0]})`, 100);
      return true;
    } catch (e) {
      console.error('WebLLM load error:', e);
      this.notify('error', `WebLLM error: ${e.message}. Using instant built-in NLU.`, 0);
      return false;
    }
  }

  /**
   * Interpret a spoken or typed prompt using both the instant semantic NLU parser and
   * (when loaded) the in-browser WebLLM model.
   */
  async interpret(userText, context) {
    const fastActions = parseNaturalVisualCommand(userText, context.catalog, context.labels);

    if (this.status !== 'ready' || !this.engine) {
      return {
        actions: fastActions,
        reply: fastActions.length
          ? null
          : `Try saying: "center on Panama", "show Arctic", "rewind to 4 days ago", "show Boulder profile", or load WebLLM for full AI chat!`,
        source: 'nlu',
      };
    }

    const sceneSummary = {
      currentModel: context.currentModel,
      fact: context.fact,
      backtrackHours: Math.round(context.explode * 336),
      groups: context.labels.map((l, i) => `${i}: ${l.label} (${l.info})`),
      availableHysplitModels: context.catalog.filter((d) => d.kind === 'hysplit').map((d) => d.name),
    };

    try {
      // Disable Qwen3 thinking blocks with /no_think so JSON comes back in <250ms
      const promptText = `${ this.modelId.startsWith('Qwen3') ? '/no_think\n' : '' }Scene state: ${JSON.stringify(sceneSummary)}\nUser request: "${userText}"`;
      const res = await this.engine.chat.completions.create({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: promptText },
        ],
        temperature: 0.1,
        max_tokens: 180,
      });
      let raw = res.choices?.[0]?.message?.content || '';
      raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const firstBrace = raw.indexOf('{'), lastBrace = raw.lastIndexOf('}');
      if (firstBrace >= 0 && lastBrace > firstBrace) {
        const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
        const llmActions = Array.isArray(parsed.actions) ? parsed.actions : [];
        // Merge deterministic NLU actions with LLM actions (LLM actions + any non-conflicting fastActions)
        const combined = [...llmActions];
        for (const fa of fastActions) {
          if (!combined.some((ca) => ca.type === fa.type)) combined.push(fa);
        }
        return {
          actions: combined,
          reply: parsed.reply || '',
          source: 'webllm',
        };
      }
    } catch (e) {
      console.warn('WebLLM inference fallback to NLU:', e);
    }
    return { actions: fastActions, reply: null, source: 'nlu' };
  }
}
