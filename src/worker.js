// Builds model point clouds off the main thread (a 200k-point engine takes a few hundred ms),
// so switching models never stutters the render loop. Buffers are transferred, not copied.
import { buildModel } from './models/catalog.js';

self.onmessage = (e) => {
  const { id, index, n } = e.data;
  try {
    const m = buildModel(index, n);
    const out = { id, index, n, target: m.target, offset: m.offset, tint: m.tint, pick: m.pick, centerline: m.centerline || null, centerlineRows: m.centerlineRows || 0, labels: m.labels, groups: m.groups, fitScale: m.fitScale, exCenter: m.exCenter, ms: m.ms };
    const xfer = [m.target.buffer, m.offset.buffer, m.tint.buffer, m.pick.buffer];
    if (m.centerline?.buffer) xfer.push(m.centerline.buffer);
    self.postMessage(out, xfer);
  } catch (err) {
    self.postMessage({ id, index, error: String((err && err.stack) || err) });
  }
};
