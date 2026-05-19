// Renderer — React (UMD) UI. Single window with three concerns:
//   1. Top bar shows the Lab88 server URL + a health pill.
//   2. Left column lists registered instruments, with start/stop and
//      an "Add instrument" form.
//   3. Right column shows the live activity log + upload queue.
//
// All state mirrors what main.js sends in the "snapshot" payload.

const e = React.createElement;
const { useState, useEffect, useCallback } = React;

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-GB", { hour12: false });
}
function fmtRel(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return s + "s";
  if (s < 3600) return Math.floor(s / 60) + "m";
  return Math.floor(s / 3600) + "h";
}

function App() {
  const [snap, setSnap] = useState({
    config: { serverUrl: "", apiKey: "", instruments: [] },
    queue: [], activity: [], upload: { serverHealth: "unknown", pending: 0 },
    instrumentStatus: {},
  });
  const refresh = useCallback(async () => setSnap(await window.listener.snapshot()), []);

  useEffect(() => {
    refresh();
    window.listener.onActivity((entry) => {
      setSnap(s => ({ ...s, activity: [...s.activity.slice(-199), entry] }));
    });
    window.listener.onSnapshot((next) => setSnap(next));
    // Refresh upload-status pill every few seconds even when nothing else fires.
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  return e(React.Fragment, null,
    e(TopBar, { snap, refresh }),
    e("div", { className: "layout" },
      e("div", { className: "col" },
        e(ServerCard, { snap, refresh }),
        e(InstrumentsCard, { snap, refresh }),
        e(NewInstrumentCard, { refresh }),
      ),
      e("div", { className: "col" },
        e(UploadQueueCard, { snap, refresh }),
        e(ActivityCard, { snap }),
      ),
    ),
  );
}

function TopBar({ snap, refresh }) {
  const h = snap.upload.serverHealth;
  return e("div", { className: "topbar" },
    e("div", { className: "brand" },
      e("div", { className: "brand-mark" }, "L"),
      e("div", null,
        e("div", { className: "brand-title" }, "Lab88 Listener"),
        e("div", { className: "brand-sub" }, "INSTRUMENT BRIDGE"),
      ),
    ),
    e("div", { style: { textAlign: "center" } },
      e("span", { className: "server-pill" },
        e("span", { className: "dot " + h }, null),
        e("span", null, snap.config.serverUrl || "(no server)"),
        e("span", { style: { color: "var(--ink-3)", marginLeft: 6 } }, "·"),
        e("span", null, snap.upload.pending + " pending"),
      ),
    ),
    e("div", null,
      e("button", { className: "btn ghost", onClick: () => { window.listener.tickNow(); refresh(); } }, "Sync now"),
    ),
  );
}

function ServerCard({ snap, refresh }) {
  const [serverUrl, setUrl] = useState(snap.config.serverUrl || "");
  const [apiKey, setKey]    = useState(snap.config.apiKey || "");
  useEffect(() => {
    setUrl(snap.config.serverUrl || "");
    setKey(snap.config.apiKey || "");
  }, [snap.config.serverUrl, snap.config.apiKey]);
  const save = async () => {
    await window.listener.setServer({ serverUrl, apiKey });
    refresh();
  };
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Lab88 Server"),
      e("span", { className: "card-sub" }, "POST /api/samples"),
    ),
    e("div", { className: "card-body" },
      e("div", { className: "row" },
        e("div", null,
          e("div", { className: "label" }, "Server URL"),
          e("input", { className: "input", value: serverUrl, onChange: ev => setUrl(ev.target.value), placeholder: "http://lab88.example/api" }),
        ),
        e("div", null,
          e("div", { className: "label" }, "API Key (optional)"),
          e("input", { className: "input", value: apiKey, onChange: ev => setKey(ev.target.value), placeholder: "—" }),
        ),
        e("div", null,
          e("div", { className: "label" }, " "),
          e("button", { className: "btn primary", onClick: save }, "Save"),
        ),
      ),
    ),
  );
}

function InstrumentsCard({ snap, refresh }) {
  const ins = snap.config.instruments;
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Instruments"),
      e("span", { className: "card-sub" }, ins.length + " REGISTERED"),
    ),
    e("div", { className: "card-body no-pad" },
      ins.length === 0
        ? e("div", { className: "empty" }, "No instruments registered. Add one below.")
        : ins.map(i => e(InstrumentRow, { key: i.id, ins: i, status: snap.instrumentStatus[i.id], refresh })),
    ),
  );
}

function InstrumentRow({ ins, status, refresh }) {
  const running = status && status.running && !status.error;
  const remove = async () => { if (confirm("Remove " + ins.name + "?")) { await window.listener.removeInstrument(ins.id); refresh(); } };
  const toggle = async () => {
    if (running) await window.listener.stopInstrument(ins.id);
    else         await window.listener.startInstrument(ins.id);
    refresh();
  };
  const meta = (() => {
    if (status?.error) return status.error;
    if (ins.transport === "filedrop") return "watch: " + (ins.watchPath || "(unset)");
    if (ins.transport === "serial")   return "serial: " + (ins.serialPort || "(unset)") + " @ " + (ins.baudRate || 9600);
    if (ins.transport === "tcp")      return "tcp: " + (ins.tcpHost || "0.0.0.0") + ":" + (ins.tcpPort || "(unset)");
    return ins.transport;
  })();
  return e("div", { className: "instrument-row" },
    e("span", { className: "dot " + (status?.error ? "down" : running ? "ok" : "unknown") }),
    e("div", null,
      e("div", { className: "instrument-name" }, ins.name),
      e("div", { className: "instrument-meta" }, meta),
    ),
    e("span", { className: "tag" }, (ins.sampleType || "diesel-cf1")),
    e("button", { className: "btn small", onClick: toggle }, running ? "Stop" : "Start"),
    e("button", { className: "btn small ghost", onClick: remove }, "Remove"),
  );
}

function NewInstrumentCard({ refresh }) {
  const [draft, setDraft] = useState({
    name: "FluidScan Q1100",
    transport: "filedrop",
    watchPath: "",
    serialPort: "", baudRate: 9600,
    tcpHost: "0.0.0.0", tcpPort: "",
    assetId: "",
    sampleType: "diesel-cf1",
  });
  const set = (k, v) => setDraft(d => ({ ...d, [k]: v }));
  const submit = async () => {
    if (!draft.name.trim()) return;
    const spec = { ...draft, name: draft.name.trim() };
    if (draft.transport === "filedrop" && !draft.watchPath.trim()) { alert("Watch path is required."); return; }
    if (draft.transport === "serial"   && !draft.serialPort.trim()) { alert("Serial port is required."); return; }
    if (draft.transport === "tcp"      && !draft.tcpPort)           { alert("TCP port is required.");    return; }
    await window.listener.addInstrument(spec);
    setDraft(d => ({ ...d, watchPath: "", serialPort: "", tcpPort: "" }));
    refresh();
  };
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Add Instrument"),
    ),
    e("div", { className: "card-body" },
      e("div", { className: "row" },
        e("div", null,
          e("div", { className: "label" }, "Name"),
          e("input", { className: "input", value: draft.name, onChange: ev => set("name", ev.target.value) }),
        ),
        e("div", null,
          e("div", { className: "label" }, "Transport"),
          e("select", { className: "select", value: draft.transport, onChange: ev => set("transport", ev.target.value) },
            e("option", { value: "filedrop" }, "File drop (directory)"),
            e("option", { value: "serial" },   "Serial (RS-232)"),
            e("option", { value: "tcp" },      "TCP (server)"),
          ),
        ),
        e("div", null,
          e("div", { className: "label" }, "Sample type"),
          e("select", { className: "select", value: draft.sampleType, onChange: ev => set("sampleType", ev.target.value) },
            e("option", { value: "diesel-cf1" }, "diesel-cf1"),
            e("option", { value: "piston-oil" }, "piston-oil"),
            e("option", { value: "piston-quick" }, "piston-quick"),
            e("option", { value: "rotax" }, "rotax"),
            e("option", { value: "manual" }, "manual"),
          ),
        ),
      ),
      e("div", { className: "row", style: { marginTop: 10 } },
        draft.transport === "filedrop" &&
          e("div", { style: { gridColumn: "1 / -1" } },
            e("div", { className: "label" }, "Watch directory (absolute path)"),
            e("input", { className: "input", value: draft.watchPath, onChange: ev => set("watchPath", ev.target.value), placeholder: "/var/spool/lab88/fluidscan" }),
          ),
        draft.transport === "serial" && [
          e("div", { key: "p" },
            e("div", { className: "label" }, "Serial port"),
            e("input", { className: "input", value: draft.serialPort, onChange: ev => set("serialPort", ev.target.value), placeholder: "COM3 / /dev/ttyUSB0" }),
          ),
          e("div", { key: "b" },
            e("div", { className: "label" }, "Baud rate"),
            e("input", { className: "input mono", type: "number", value: draft.baudRate, onChange: ev => set("baudRate", Number(ev.target.value) || 9600) }),
          ),
        ],
        draft.transport === "tcp" && [
          e("div", { key: "h" },
            e("div", { className: "label" }, "Bind host"),
            e("input", { className: "input mono", value: draft.tcpHost, onChange: ev => set("tcpHost", ev.target.value) }),
          ),
          e("div", { key: "p" },
            e("div", { className: "label" }, "Port"),
            e("input", { className: "input mono", type: "number", value: draft.tcpPort, onChange: ev => set("tcpPort", Number(ev.target.value) || "") }),
          ),
        ],
        e("div", null,
          e("div", { className: "label" }, "Engine ID (optional)"),
          e("input", { className: "input mono", value: draft.assetId, onChange: ev => set("assetId", ev.target.value), placeholder: "A-…" }),
        ),
        e("div", { style: { alignSelf: "end" } },
          e("button", { className: "btn primary", onClick: submit }, "Add instrument"),
        ),
      ),
      e("div", { className: "muted", style: { fontSize: 11, marginTop: 8 } },
        "Engine ID is optional. Without it the listener uploads draft samples with no engine attached; an analyst links them on the Lab88 side.",
      ),
    ),
  );
}

function UploadQueueCard({ snap, refresh }) {
  const q = snap.queue;
  const clear = async () => { if (confirm("Drop every queued upload?")) { await window.listener.clearQueue(); refresh(); } };
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Upload Queue"),
      e("span", { className: "card-sub" }, q.length + " QUEUED"),
      q.length > 0 && e("button", { className: "btn small ghost", style: { marginLeft: 8 }, onClick: clear }, "Clear"),
    ),
    e("div", { className: "card-body no-pad" },
      q.length === 0
        ? e("div", { className: "empty" }, "Nothing waiting to upload.")
        : q.slice(-20).reverse().map(item =>
            e("div", { key: item.id, className: "queue-row" },
              e("div", null,
                e("div", { className: "mono", style: { fontSize: 11.5 } }, item.source + " · " + (item.payload.results?.length || 0) + " readings"),
                item.lastError && e("div", { className: "err" }, "× " + item.lastError),
              ),
              e("span", { className: "tag" }, "try " + (item.attempts || 0)),
              e("button", { className: "btn small ghost", onClick: () => window.listener.removeQueueItem(item.id) }, "×"),
            ),
          ),
    ),
  );
}

function ActivityCard({ snap }) {
  const a = snap.activity || [];
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Live Activity"),
      e("span", { className: "card-sub" }, a.length + " EVENTS"),
    ),
    e("div", { className: "card-body activity", style: { maxHeight: 460, overflow: "auto" } },
      a.length === 0
        ? e("div", { className: "empty" }, "No activity yet.")
        : a.slice(-100).reverse().map((entry, i) =>
            e("div", { key: i, className: "activity-row " + (entry.level || "info") },
              e("span", { className: "ts" }, fmtTime(entry.ts)),
              e("span", { className: "src" }, entry.instrumentId || "system"),
              e("span", { className: "text" }, entry.text),
            ),
          ),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(e(App));
