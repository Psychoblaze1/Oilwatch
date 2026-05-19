// Drains the upload queue. Runs on a 3-second tick; for each "due"
// item, POSTs the sample payload to {serverUrl}/api/samples. On
// success the item is removed; on failure it's re-scheduled with
// exponential backoff (lives in queue.js).
//
// Node 18+ has a global fetch.

const config = require("./config");
const queue  = require("./queue");

const bus = new (require("events").EventEmitter)();

let timer = null;
let lastError = null;
let serverHealth = "unknown";  // "ok" | "down" | "unknown"

function start() {
  if (timer) return;
  tick().catch(() => {});
  timer = setInterval(() => tick().catch(() => {}), 3000);
}
function stop() { if (timer) { clearInterval(timer); timer = null; } }

async function tick() {
  // Light health probe to surface "server down" in the UI without
  // tying it to whether the queue happens to be empty.
  await probe();

  const due = queue.due();
  if (!due.length) return;
  for (const item of due) {
    try {
      await upload(item.payload);
      queue.markSuccess(item.id);
      bus.emit("uploaded", { item });
    } catch (e) {
      queue.markFailure(item.id, e);
      bus.emit("failed", { item, error: e.message });
    }
  }
}

async function probe() {
  const { serverUrl } = config.get();
  try {
    const r = await fetch(serverUrl.replace(/\/$/, "") + "/api/health", { method: "GET" });
    serverHealth = r.ok ? "ok" : "down";
    lastError = r.ok ? null : `health ${r.status}`;
  } catch (e) {
    serverHealth = "down";
    lastError = e.message;
  }
}

async function upload(payload) {
  const { serverUrl, apiKey } = config.get();
  const url = serverUrl.replace(/\/$/, "") + "/api/samples";
  const headers = { "content-type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`POST /api/samples ${r.status} ${t.slice(0, 200)}`);
  }
  return r.json();
}

function status() { return { serverHealth, lastError, pending: queue.size() }; }
function on(event, fn) { bus.on(event, fn); }

module.exports = { start, stop, tick, upload, status, on };
