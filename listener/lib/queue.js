// Persisted upload queue. Each item is a draft sample payload plus
// retry metadata. We deliberately use a plain JSON file (not SQLite)
// to keep the listener install lightweight — no native deps required.
// The queue is small (one entry per pending instrument reading) so
// JSON is fine.

const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const bus = new EventEmitter();

let queuePath = null;
let items = [];           // [{ id, payload, source, attempts, nextAttemptAt, lastError, createdAt }]

function init(userDataDir) {
  queuePath = path.join(userDataDir, "listener.queue.json");
  if (fs.existsSync(queuePath)) {
    try { items = JSON.parse(fs.readFileSync(queuePath, "utf8")); }
    catch (_) { items = []; }
  }
  return items;
}

function persist() {
  if (!queuePath) return;
  fs.writeFileSync(queuePath, JSON.stringify(items, null, 2));
}

function size() { return items.length; }
function snapshot() { return items.slice(); }

function enqueue({ payload, source }) {
  const item = {
    id: "q_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    payload, source: source || "listener",
    attempts: 0, nextAttemptAt: 0,
    lastError: null,
    createdAt: new Date().toISOString(),
  };
  items.push(item);
  persist();
  bus.emit("change");
  return item;
}

function due() {
  const now = Date.now();
  return items.filter(i => i.nextAttemptAt <= now);
}

function markSuccess(id) {
  items = items.filter(i => i.id !== id);
  persist();
  bus.emit("change");
}

function markFailure(id, err) {
  const i = items.find(x => x.id === id);
  if (!i) return;
  i.attempts += 1;
  i.lastError = err && err.message ? err.message : String(err);
  // Exponential backoff capped at 5 minutes.
  const delayMs = Math.min(5 * 60_000, 2_000 * Math.pow(2, i.attempts - 1));
  i.nextAttemptAt = Date.now() + delayMs;
  persist();
  bus.emit("change");
}

function remove(id) {
  items = items.filter(i => i.id !== id);
  persist();
  bus.emit("change");
}
function clearAll() {
  items = [];
  persist();
  bus.emit("change");
}

function on(event, fn) { bus.on(event, fn); }

module.exports = { init, size, snapshot, enqueue, due, markSuccess, markFailure, remove, clearAll, on };
