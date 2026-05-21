// Active sample-assembly session.
//
// When the operator opens the Console tab and clicks "Start session",
// the listener routes incoming instrument readings into a working
// payload instead of immediately enqueueing them for upload. The
// operator can then review the live values, attach ferrography images
// + meta (hours, notes), and submit the assembled sample as one
// /api/samples POST when ready.
//
// Mirrors the TruVu 360 Device Console workflow without driving the
// instruments themselves — our adapters are passive (file-drop /
// serial / TCP listeners). "Listening" replaces "Play".

const { EventEmitter } = require("events");
const bus = new EventEmitter();

let active = null;
//   {
//     id, sampleId, engineId, sampleType,
//     startedAt,
//     readings: { [code]: { value, source, at } },
//     files:    { irVisionFile, flashPointFile, additivesFile },
//     images:   { [slot]: dataUrl },  // ferrography categories + free image slots
//     meta:     { hoursOil, hoursAsset, notes, component, priority }
//   }

function start({ sampleId, engineId, sampleType, priority }) {
  active = {
    id: "sess_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    sampleId: sampleId || null,
    engineId: engineId || null,
    sampleType: sampleType || "piston-oil",
    startedAt: Date.now(),
    readings: {},
    files: { irVisionFile: null, flashPointFile: null, additivesFile: null },
    images: {},
    meta: { hoursOil: null, hoursAsset: null, notes: "", component: "", priority: priority || "STD" },
  };
  bus.emit("change", active);
  return active;
}
function stop() {
  const prev = active;
  active = null;
  bus.emit("change", null);
  return prev;
}
function isActive() { return !!active; }
function get() { return active; }

// Pull readings into the live session. Called by sink.js when an
// adapter delivers a payload during an active session. The optional
// `files` map carries raw instrument-file data URLs so the assembled
// sample can preserve them for re-processing later.
function ingest({ readings, source, files }) {
  if (!active) return false;
  const at = Date.now();
  for (const r of (readings || [])) {
    if (r == null || r.code == null) continue;
    active.readings[r.code] = { value: r.value, source: source || "instrument", at };
  }
  if (files) {
    for (const k of ["irVisionFile", "flashPointFile", "additivesFile"]) {
      if (files[k]) active.files[k] = files[k];
    }
  }
  bus.emit("change", active);
  return true;
}

function setMeta(patch) {
  if (!active) return;
  active.meta = { ...active.meta, ...(patch || {}) };
  bus.emit("change", active);
}
function setIdentity(patch) {
  if (!active) return;
  if ("sampleId"   in patch) active.sampleId   = patch.sampleId || null;
  if ("engineId"   in patch) active.engineId   = patch.engineId || null;
  if ("sampleType" in patch) active.sampleType = patch.sampleType || active.sampleType;
  bus.emit("change", active);
}
function setImage(slot, dataUrl) {
  if (!active) return;
  if (!slot) return;
  if (dataUrl) active.images[slot] = dataUrl;
  else delete active.images[slot];
  bus.emit("change", active);
}
function clearReading(code) {
  if (!active) return;
  delete active.readings[code];
  bus.emit("change", active);
}

// Convert the session into the shape /api/samples expects.
function toPayload() {
  if (!active) return null;
  const results = Object.entries(active.readings).map(([code, r]) => ({ code, value: r.value }));
  return {
    id: active.sampleId || undefined,
    assetId: active.engineId || null,
    component: active.meta.component || "Console session",
    receivedAt: new Date().toISOString(),
    status: "DRAFT",
    priority: active.meta.priority || "STD",
    analyst: "Listener Console",
    sampleType: active.sampleType,
    results,
    note: composeNote(active),
    irVisionFile:   active.files.irVisionFile   || null,
    flashPointFile: active.files.flashPointFile || null,
    additivesFile:  active.files.additivesFile  || null,
  };
}
function composeNote(s) {
  const parts = [];
  if (s.meta.hoursOil   != null) parts.push(`Oil hours: ${s.meta.hoursOil}`);
  if (s.meta.hoursAsset != null) parts.push(`Asset hours: ${s.meta.hoursAsset}`);
  if (s.meta.notes) parts.push(s.meta.notes);
  return parts.join(" · ") || null;
}

function on(event, fn) { bus.on(event, fn); }

module.exports = {
  start, stop, isActive, get,
  ingest, setMeta, setIdentity, setImage, clearReading,
  toPayload,
  on,
};
