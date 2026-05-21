// Lab88 Listener — Electron main process.
//
// Owns:
//   - Persisted config (Lab88 server URL + instrument list)
//   - Adapter lifecycle (filedrop / serial / tcp)
//   - Upload queue (durable JSON file)
//   - Uploader (drains the queue, posts /api/samples)
//
// Renders a single window from renderer/index.html. The renderer
// talks to this process via the preload bridge (ipcRenderer).

const path = require("path");
const { app, BrowserWindow, ipcMain } = require("electron");

const config   = require("./lib/config");
const queue    = require("./lib/queue");
const uploader = require("./lib/uploader");
const session  = require("./lib/session");

const filedrop  = require("./lib/adapters/filedrop");
const serial    = require("./lib/adapters/serial");
const tcp       = require("./lib/adapters/tcp");
const discovery = require("./lib/discovery");

const ADAPTERS = { filedrop, serial, tcp };

// In-memory registry of running adapter handles, keyed by instrument id.
const running = new Map();
// Capped activity log; the renderer pulls a snapshot + subscribes via "activity" event.
const activity = [];
const ACTIVITY_MAX = 500;

let win = null;
function pushActivity(entry) {
  const e = { ts: Date.now(), ...entry };
  activity.push(e);
  if (activity.length > ACTIVITY_MAX) activity.shift();
  if (win && !win.isDestroyed()) win.webContents.send("activity", e);
}
function pushSnapshot() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send("snapshot", currentState());
}

function currentState() {
  const cfg = config.get();
  const status = uploader.status();
  return {
    config: cfg,
    queue: queue.snapshot(),
    activity: activity.slice(-200),
    upload: {
      serverHealth: status.serverHealth,
      lastError: status.lastError,
      pending: status.pending,
    },
    instrumentStatus: Object.fromEntries(
      [...running.entries()].map(([id, h]) => [id, { running: true, info: h.info ? h.info() : null, error: h.error || null }]),
    ),
    discovery: discovery.snapshot(),
    session: session.get(),
  };
}

// ---- Adapter control --------------------------------------------------
function startInstrument(ins) {
  stopInstrument(ins.id);
  const adapter = ADAPTERS[ins.transport];
  if (!adapter) {
    pushActivity({ level: "error", instrumentId: ins.id, text: `unknown transport: ${ins.transport}` });
    return;
  }
  const handle = adapter.start(ins, { onActivity: pushActivity });
  running.set(ins.id, handle);
  if (handle.error) {
    pushActivity({ level: "error", instrumentId: ins.id, text: handle.error });
  } else {
    pushActivity({ level: "info", instrumentId: ins.id, text: `started ${ins.transport} adapter for ${ins.name}` });
  }
  pushSnapshot();
}
function stopInstrument(id) {
  const h = running.get(id);
  if (h) {
    try { h.stop(); } catch (_) {}
    running.delete(id);
    pushActivity({ level: "info", instrumentId: id, text: "adapter stopped" });
  }
}

// ---- IPC -------------------------------------------------------------
ipcMain.handle("snapshot", () => currentState());

ipcMain.handle("server:set", (_evt, payload) => {
  config.setServer(payload || {});
  pushActivity({ level: "info", text: `server config updated → ${config.get().serverUrl}` });
  pushSnapshot();
  return config.get();
});

ipcMain.handle("instrument:add", (_evt, spec) => {
  const ins = config.addInstrument(spec || {});
  pushActivity({ level: "info", instrumentId: ins.id, text: `registered ${ins.name} (${ins.transport})` });
  startInstrument(ins);
  return ins;
});
ipcMain.handle("instrument:update", (_evt, { id, patch }) => {
  const ins = config.updateInstrument(id, patch || {});
  if (ins) { stopInstrument(id); startInstrument(ins); }
  return ins;
});
ipcMain.handle("instrument:remove", (_evt, id) => {
  stopInstrument(id);
  config.removeInstrument(id);
  pushSnapshot();
});
ipcMain.handle("instrument:start", (_evt, id) => {
  const ins = config.get().instruments.find(i => i.id === id);
  if (ins) startInstrument(ins);
});
ipcMain.handle("instrument:stop",  (_evt, id) => { stopInstrument(id); pushSnapshot(); });

ipcMain.handle("discovery:rescan", async () => { await discovery.scanSerial(); pushSnapshot(); return discovery.snapshot(); });
ipcMain.handle("discovery:adopt", (_evt, { portPath, extra }) => {
  const ins = discovery.adoptSerial(portPath, extra || {});
  pushActivity({ level: "info", instrumentId: ins.id, text: `adopted serial port ${portPath} as ${ins.name}` });
  startInstrument(ins);
  return ins;
});

ipcMain.handle("queue:remove", (_evt, id) => queue.remove(id));
ipcMain.handle("queue:clear",  () => queue.clearAll());
ipcMain.handle("queue:tick",   () => uploader.tick());

// ---- Console session IPC --------------------------------------------
ipcMain.handle("session:start", (_evt, opts) => {
  const s = session.start(opts || {});
  pushActivity({ level: "info", text: `console session started${opts?.sampleId ? " for " + opts.sampleId : ""}` });
  pushSnapshot();
  return s;
});
ipcMain.handle("session:stop", () => {
  session.stop();
  pushActivity({ level: "info", text: "console session cleared" });
  pushSnapshot();
  return null;
});
ipcMain.handle("session:setMeta", (_evt, patch) => { session.setMeta(patch || {}); pushSnapshot(); return session.get(); });
ipcMain.handle("session:setIdentity", (_evt, patch) => { session.setIdentity(patch || {}); pushSnapshot(); return session.get(); });
ipcMain.handle("session:setImage", (_evt, { slot, dataUrl }) => { session.setImage(slot, dataUrl); pushSnapshot(); return session.get(); });
ipcMain.handle("session:clearReading", (_evt, code) => { session.clearReading(code); pushSnapshot(); return session.get(); });
ipcMain.handle("session:submit", async () => {
  const s = session.get();
  if (!s) throw new Error("no active session");
  const payload = session.toPayload();
  const item = queue.enqueue({ payload, source: "console" });
  pushActivity({ level: "info", text: `console session submitted (${payload.results?.length || 0} readings) → upload queue` });
  // Trigger an immediate upload attempt so the operator sees fast feedback.
  uploader.tick().catch(() => {});
  session.stop();
  pushSnapshot();
  return { ok: true, itemId: item.id };
});

// Fetch engine roster from the Lab88 server so the Console can offer a
// real engine picker. Best-effort — if the server is unreachable the
// Console falls back to free-text engine-ID input.
ipcMain.handle("lab88:engines", async () => {
  const { serverUrl } = config.get();
  if (!serverUrl) return { engines: [], error: "no server configured" };
  try {
    const r = await fetch(serverUrl.replace(/\/$/, "") + "/api/bootstrap");
    if (!r.ok) return { engines: [], error: "bootstrap " + r.status };
    const j = await r.json();
    return { engines: j.engines || [], sites: j.sites || [] };
  } catch (e) {
    return { engines: [], error: e.message };
  }
});

// ---- Lifecycle ------------------------------------------------------
app.whenReady().then(() => {
  config.init(app.getPath("userData"));
  queue.init(app.getPath("userData"));

  win = new BrowserWindow({
    width: 1180, height: 760, minWidth: 880, minHeight: 560,
    title: "Lab88 Listener",
    backgroundColor: "#faf8f4",
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, "renderer", "index.html"));

  queue.on("change", () => pushSnapshot());
  session.on("change", () => pushSnapshot());
  uploader.on("uploaded", ({ item }) => pushActivity({
    level: "info", instrumentId: item.source, text: `uploaded ${item.payload.results?.length || 0} readings to Lab88`,
  }));
  uploader.on("failed", ({ item, error }) => pushActivity({
    level: "warn", instrumentId: item.source, text: `upload failed (attempt ${item.attempts}): ${error}`,
  }));

  // Discovery: auto-creates ~/Lab88/Incoming and (if no filedrop is
  // configured yet) registers it as an instrument so file-drop works
  // out of the box. Then polls serial ports for adopt-able candidates.
  discovery.start({ onActivity: pushActivity, onChange: pushSnapshot });

  // Auto-start every previously-saved instrument (including the inbox
  // discovery just registered).
  for (const ins of config.get().instruments) startInstrument(ins);
  uploader.start();
});

app.on("window-all-closed", () => {
  for (const id of [...running.keys()]) stopInstrument(id);
  discovery.stop();
  uploader.stop();
  app.quit();
});
