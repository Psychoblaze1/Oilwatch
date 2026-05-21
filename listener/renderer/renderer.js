// Renderer — React (UMD) UI.
//
// Two top-level tabs:
//   - Console:  TruVu 360 Device Console-style operator workspace.
//               Start a session, assemble a sample from live instrument
//               readings, attach ferrography images, submit.
//   - Settings: original instrument bridge configuration screen
//               (server, instruments, queue, activity).
//
// All state mirrors what main.js sends in the "snapshot" payload.

const e = React.createElement;
const { useState, useEffect, useCallback, useMemo, useRef } = React;

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

// Parameter groups used by the Console — modeled after TruVu's four
// instrument cards. Each group lists the parameter codes (matching
// server/data.jsx PARAM_DEFS + DIESEL_PARAMS) it owns.
const PARAM_GROUPS = [
  {
    id: "elemental", label: "Elemental Analysis", icon: "⚙",
    codes: ["Fe","Cr","Al","Cu","Pb","Ni","Si","Sn","Ag","Ti","V","B","Ca","Ba","Mg","Mo","P","Zn","Mn",
            "El_Sulphur","El_Fe","El_Al","El_Mg","El_Zn","El_Pb","El_Si","El_Mn","El_V"],
  },
  {
    id: "viscosity", label: "Viscosity", icon: "≈",
    codes: ["Visc100","KinVisc40"],
  },
  {
    id: "infrared",  label: "Infrared", icon: "≋",
    codes: ["H2O","WaterCt","Fuel","FlashPt","IR_Density","IR_Cetane","IR_CFPP"],
  },
  {
    id: "particle",  label: "Particle Analysis", icon: "◌",
    codes: ["TotalContam","P_4um","P_6um","P_14um","ISO4406","Sulphur","Density20","T90Dist",
            "Dist_IBP","Dist_T10","Dist_T50","Dist_T65","Dist_T85","Dist_T95","Dist_FBP"],
  },
];
// Ferrography image slots — mirrors TruVu Particle Analysis gallery.
const IMAGE_SLOTS = [
  { id: "Fatigue",     label: "Fatigue" },
  { id: "Cutting",     label: "Cutting" },
  { id: "Sliding",     label: "Sliding" },
  { id: "NonMetallic", label: "Non-Metallic" },
  { id: "Water",       label: "Water" },
  { id: "Unknown",     label: "Unknown" },
  { id: "Image1",      label: "Image 1" },
  { id: "Image2",      label: "Image 2" },
  { id: "Image3",      label: "Image 3" },
];

function App() {
  const [snap, setSnap] = useState({
    config: { serverUrl: "", apiKey: "", instruments: [] },
    queue: [], activity: [], upload: { serverHealth: "unknown", pending: 0 },
    instrumentStatus: {},
    discovery: { inboxPath: null, serial: [], serialSupported: false, lastScanAt: 0 },
    session: null,
  });
  const [tab, setTab] = useState("console");
  const refresh = useCallback(async () => setSnap(await window.listener.snapshot()), []);

  useEffect(() => {
    refresh();
    window.listener.onActivity((entry) => {
      setSnap(s => ({ ...s, activity: [...s.activity.slice(-199), entry] }));
    });
    window.listener.onSnapshot((next) => setSnap(next));
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  return e(React.Fragment, null,
    e(TopBar, { snap, refresh, tab, setTab }),
    tab === "console"
      ? e(ConsoleView, { snap, refresh })
      : e(SettingsView, { snap, refresh }),
  );
}

function TopBar({ snap, refresh, tab, setTab }) {
  const h = snap.upload.serverHealth;
  return e("div", { className: "topbar" },
    e("div", { className: "brand" },
      e("div", { className: "brand-mark" }, "L"),
      e("div", null,
        e("div", { className: "brand-title" }, "Lab88 Listener"),
        e("div", { className: "brand-sub" }, "INSTRUMENT BRIDGE"),
      ),
    ),
    e("div", { className: "tabs" },
      e("button", { className: "tab " + (tab === "console"  ? "active" : ""), onClick: () => setTab("console") },  "Console"),
      e("button", { className: "tab " + (tab === "settings" ? "active" : ""), onClick: () => setTab("settings") }, "Settings"),
    ),
    e("div", { style: { display: "flex", gap: 10, alignItems: "center", justifyContent: "flex-end" } },
      e("span", { className: "server-pill" },
        e("span", { className: "dot " + h }, null),
        e("span", null, snap.config.serverUrl || "(no server)"),
        e("span", { style: { color: "var(--ink-3)", marginLeft: 6 } }, "·"),
        e("span", null, snap.upload.pending + " pending"),
      ),
      e("button", { className: "btn ghost", onClick: () => { window.listener.tickNow(); refresh(); } }, "Sync now"),
    ),
  );
}

// ===========================================================
// CONSOLE VIEW — TruVu 360 Device Console–style workspace
// ===========================================================
function ConsoleView({ snap, refresh }) {
  const sess = snap.session;
  const active = !!sess;
  const [engines, setEngines] = useState([]);
  const [enginesErr, setEnginesErr] = useState(null);
  useEffect(() => {
    (async () => {
      const r = await window.listener.fetchEngines();
      setEngines(r.engines || []);
      setEnginesErr(r.error || null);
    })();
  }, [snap.config.serverUrl]);

  return e("div", { className: "console" },
    e(ConsoleHeader, { sess, engines, enginesErr, snap }),
    active
      ? e("div", { className: "console-grid" },
          e(ConsoleLeftRail,   { sess, snap }),
          e(ConsoleCenter,     { sess, engines }),
          e(ConsoleRightRail,  { sess }),
        )
      : e(ConsoleStartCard,    { engines, enginesErr }),
  );
}

function ConsoleHeader({ sess, engines, enginesErr, snap }) {
  if (!sess) return null;
  const eng = engines.find(en => en.id === sess.engineId);
  const readingCount = Object.keys(sess.readings || {}).length;
  const imageCount   = Object.keys(sess.images || {}).length;
  const onScan = async (val) => {
    if (val) await window.listener.setSessionIdentity({ sampleId: val });
  };
  const submit = async () => {
    if (!confirm(`Submit session with ${readingCount} readings${imageCount ? " + " + imageCount + " image(s)" : ""}?`)) return;
    try { await window.listener.submitSession(); }
    catch (e) { alert("Submit failed: " + e.message); }
  };
  const cancel = async () => {
    if (!confirm("Discard the current session? Captured readings will be lost.")) return;
    await window.listener.stopSession();
  };
  return e("div", { className: "console-header" },
    e("div", { className: "console-breadcrumb mono" },
      (eng ? `${eng.siteName || "—"} → ${eng.locationName || "—"} → ${eng.assetTypeName || eng.classLabel || "—"} → ${eng.name}` : "Unlinked sample"),
      sess.meta.component ? " → " + sess.meta.component : "",
    ),
    e("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
      e("div", { className: "barcode-input" },
        e("span", { className: "label mono", style: { marginRight: 6 } }, "SAMPLE ID"),
        e("input", {
          className: "input mono", style: { width: 180 },
          defaultValue: sess.sampleId || "",
          onBlur: ev => onScan(ev.target.value.trim()),
          onKeyDown: ev => { if (ev.key === "Enter") { onScan(ev.target.value.trim()); ev.target.blur(); } },
          placeholder: "scan or type…",
        }),
      ),
      e("span", { className: "session-pill" },
        e("span", { className: "dot ok" }), e("span", null, "Session active"),
        e("span", { className: "mono", style: { color: "var(--ink-3)", marginLeft: 8 } },
          `${readingCount} reading${readingCount === 1 ? "" : "s"}${imageCount ? ` · ${imageCount} image` + (imageCount === 1 ? "" : "s") : ""}`,
        ),
      ),
      e("button", { className: "btn ghost", onClick: cancel }, "Discard"),
      e("button", { className: "btn primary", onClick: submit, disabled: readingCount === 0 }, "⬆ Submit"),
    ),
  );
}

function ConsoleStartCard({ engines, enginesErr }) {
  const sampleTypes = [
    { id: "piston-oil",   label: "Piston Aircraft Oil (full panel)" },
    { id: "piston-quick", label: "Piston Oil — wear-metals only" },
    { id: "rotax",        label: "Rotax (oil + gearbox)" },
    { id: "diesel-cf1",   label: "Diesel — Sulphur Low Grade (CF1)" },
    { id: "manual",       label: "Manual entry" },
  ];
  const [draft, setDraft] = useState({ sampleId: "", engineId: "", sampleType: "piston-oil", priority: "STD" });
  const start = async () => {
    await window.listener.startSession({
      sampleId: draft.sampleId.trim() || null,
      engineId: draft.engineId || null,
      sampleType: draft.sampleType,
      priority: draft.priority,
    });
  };
  return e("div", { className: "console-empty" },
    e("div", { className: "card start-card" },
      e("div", { className: "card-head" },
        e("span", { className: "card-title" }, "Start a Console Session"),
        e("span", { className: "card-sub" }, "ROUTE NEXT READINGS INTO ONE SAMPLE"),
      ),
      e("div", { className: "card-body" },
        e("div", { className: "muted", style: { fontSize: 12, marginBottom: 14, lineHeight: 1.5 } },
          "When a session is active, any reading received from a configured instrument flows straight into this sample instead of the upload queue. ",
          "Attach ferrography images, fill in hours & notes, and click Submit when the panel is complete.",
        ),
        e("div", { className: "row" },
          e("div", null,
            e("div", { className: "label" }, "Sample ID (optional)"),
            e("input", { className: "input mono", value: draft.sampleId, onChange: ev => setDraft({ ...draft, sampleId: ev.target.value }), placeholder: "scan barcode or type S-…" }),
          ),
          e("div", null,
            e("div", { className: "label" }, "Engine"),
            e("select", { className: "select", value: draft.engineId, onChange: ev => setDraft({ ...draft, engineId: ev.target.value }) },
              e("option", { value: "" }, "— Unlinked (analyst links later) —"),
              engines.map(en => e("option", { key: en.id, value: en.id }, `${en.name} · ${en.tag || en.id}${en.siteName ? " · " + en.siteName : ""}`)),
            ),
            enginesErr && e("div", { className: "muted mono", style: { fontSize: 10.5, marginTop: 4 } }, "engines unavailable: " + enginesErr),
          ),
          e("div", null,
            e("div", { className: "label" }, "Sample type"),
            e("select", { className: "select", value: draft.sampleType, onChange: ev => setDraft({ ...draft, sampleType: ev.target.value }) },
              sampleTypes.map(t => e("option", { key: t.id, value: t.id }, t.label)),
            ),
          ),
          e("div", null,
            e("div", { className: "label" }, "Priority"),
            e("select", { className: "select", value: draft.priority, onChange: ev => setDraft({ ...draft, priority: ev.target.value }) },
              e("option", { value: "STD" }, "Standard"),
              e("option", { value: "RUSH" }, "Rush"),
            ),
          ),
        ),
        e("div", { style: { marginTop: 16, display: "flex", justifyContent: "flex-end" } },
          e("button", { className: "btn primary", onClick: start }, "▶ Start session"),
        ),
      ),
    ),
  );
}

// LEFT: 4 instrument-group cards (Elemental / Viscosity / Infrared / Particle)
function ConsoleLeftRail({ sess, snap }) {
  return e("div", { className: "console-rail" },
    PARAM_GROUPS.map(g => {
      const codes = Object.keys(sess.readings || {}).filter(c => g.codes.includes(c));
      const lastAt = codes.reduce((mx, c) => Math.max(mx, sess.readings[c].at || 0), 0);
      const status = codes.length === 0 ? "Listening…" : `${codes.length} reading${codes.length === 1 ? "" : "s"} captured`;
      return e("div", { key: g.id, className: "instr-card" },
        e("div", { className: "instr-card-head" },
          e("span", { className: "instr-icon" }, g.icon),
          e("div", { className: "instr-card-title" }, g.label.toUpperCase()),
          e("span", { className: "dot " + (codes.length ? "ok" : "unknown") }),
        ),
        e("div", { className: "instr-status mono" },
          status,
          lastAt > 0 && e("span", { className: "instr-status-time" }, " · " + fmtRel(lastAt) + " ago"),
        ),
        codes.length > 0 && e("div", { className: "instr-preview mono" },
          codes.slice(-4).map(c => e("div", { key: c, className: "instr-preview-line" },
            e("span", null, c), e("span", { style: { marginLeft: "auto" } }, fmtVal(sess.readings[c].value)),
          )),
        ),
      );
    }),
    e(InstrumentRoster, { snap }),
  );
}
function InstrumentRoster({ snap }) {
  const ins = snap.config.instruments || [];
  return e("div", { className: "instr-card" },
    e("div", { className: "instr-card-head" },
      e("span", { className: "instr-icon" }, "▤"),
      e("div", { className: "instr-card-title" }, "REGISTERED INSTRUMENTS"),
      e("span", { className: "mono", style: { color: "var(--ink-3)", fontSize: 11 } }, ins.length),
    ),
    e("div", { className: "instr-status mono" },
      ins.length === 0
        ? "None registered — go to Settings → Add Instrument."
        : ins.map(i => {
            const st = snap.instrumentStatus[i.id];
            const running = st && st.running && !st.error;
            return e("div", { key: i.id, className: "instr-roster-row" },
              e("span", { className: "dot " + (st?.error ? "down" : running ? "ok" : "unknown") }),
              e("span", { style: { color: "var(--ink-2)" } }, i.name),
              e("span", { className: "mono", style: { color: "var(--ink-3)", marginLeft: "auto", fontSize: 10.5 } }, i.transport),
            );
          }),
    ),
  );
}

// CENTER: live readings + meta
function ConsoleCenter({ sess, engines }) {
  const readings = sess.readings || {};
  const grouped = PARAM_GROUPS.map(g => ({
    ...g,
    rows: g.codes.filter(c => c in readings).map(c => ({ code: c, ...readings[c] })),
  })).filter(g => g.rows.length > 0);
  const ungrouped = Object.entries(readings)
    .filter(([c]) => !PARAM_GROUPS.some(g => g.codes.includes(c)))
    .map(([code, r]) => ({ code, ...r }));

  const setMeta = (patch) => window.listener.setSessionMeta(patch);

  return e("div", { className: "console-center" },
    grouped.length === 0 && ungrouped.length === 0
      ? e("div", { className: "card" }, e("div", { className: "card-body" },
          e("div", { className: "muted", style: { textAlign: "center", padding: 26 } },
            "Waiting for instrument readings.",
            e("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-4)", marginTop: 6 } },
              "Drop a file in the watched inbox, send over serial / TCP, or upload a CSV manually below.",
            ),
          ),
        ))
      : e("div", { className: "card" },
          e("div", { className: "card-head" },
            e("span", { className: "card-title" }, "Live Readings"),
            e("span", { className: "card-sub" }, Object.keys(readings).length + " CAPTURED"),
          ),
          e("div", { className: "card-body no-pad readings-table" },
            grouped.map(g => e("div", { key: g.id, className: "readings-group" },
              e("div", { className: "readings-group-head mono" }, g.label),
              g.rows.map(r => e("div", { key: r.code, className: "readings-row" },
                e("span", { className: "mono", style: { color: "var(--ink-3)" } }, r.code),
                e("span", { style: { color: "var(--ink)" } }, fmtVal(r.value)),
                e("span", { className: "mono", style: { color: "var(--ink-4)", fontSize: 10.5 } }, r.source),
                e("button", { className: "btn ghost small", onClick: () => window.listener.clearSessionReading(r.code) }, "×"),
              )),
            )),
            ungrouped.length > 0 && e("div", { className: "readings-group" },
              e("div", { className: "readings-group-head mono" }, "Other"),
              ungrouped.map(r => e("div", { key: r.code, className: "readings-row" },
                e("span", { className: "mono", style: { color: "var(--ink-3)" } }, r.code),
                e("span", { style: { color: "var(--ink)" } }, fmtVal(r.value)),
                e("span", { className: "mono", style: { color: "var(--ink-4)", fontSize: 10.5 } }, r.source),
                e("button", { className: "btn ghost small", onClick: () => window.listener.clearSessionReading(r.code) }, "×"),
              )),
            ),
          ),
        ),

    // Meta strip — hours + notes + manual reading entry
    e("div", { className: "card" },
      e("div", { className: "card-head" },
        e("span", { className: "card-title" }, "Operating Hours & Notes"),
      ),
      e("div", { className: "card-body" },
        e("div", { className: "row" },
          e("div", null,
            e("div", { className: "label" }, "Hours on Oil"),
            e("input", { className: "input mono", type: "number", defaultValue: sess.meta.hoursOil ?? "", onBlur: ev => setMeta({ hoursOil: ev.target.value === "" ? null : Number(ev.target.value) }), placeholder: "—" }),
          ),
          e("div", null,
            e("div", { className: "label" }, "Hours on Asset"),
            e("input", { className: "input mono", type: "number", defaultValue: sess.meta.hoursAsset ?? "", onBlur: ev => setMeta({ hoursAsset: ev.target.value === "" ? null : Number(ev.target.value) }), placeholder: "—" }),
          ),
          e("div", null,
            e("div", { className: "label" }, "Component / Sampling point"),
            e("input", { className: "input", defaultValue: sess.meta.component || "", onBlur: ev => setMeta({ component: ev.target.value }), placeholder: "Sump Drain, Before Filter…" }),
          ),
        ),
        e("div", { style: { marginTop: 10 } },
          e("div", { className: "label" }, "Notes"),
          e("textarea", { className: "input", rows: 2, defaultValue: sess.meta.notes || "", onBlur: ev => setMeta({ notes: ev.target.value }), placeholder: "Free-text observations carried into the report." }),
        ),
      ),
    ),
  );
}

// RIGHT: ferrography image gallery (TruVu Particle Analysis grid)
function ConsoleRightRail({ sess }) {
  const onPick = async (slot, file) => {
    if (!file) return;
    const dataUrl = await downsizeImage(file, 600, 0.82);
    await window.listener.setSessionImage(slot, dataUrl);
  };
  const onClear = async (slot) => window.listener.setSessionImage(slot, null);
  return e("div", { className: "console-rail right" },
    e("div", { className: "instr-card" },
      e("div", { className: "instr-card-head" },
        e("span", { className: "instr-icon" }, "◇"),
        e("div", { className: "instr-card-title" }, "PARTICLE ANALYSIS · IMAGES"),
        e("span", { className: "mono", style: { color: "var(--ink-3)", fontSize: 11 } }, Object.keys(sess.images || {}).length + "/9"),
      ),
      e("div", { className: "image-grid" },
        IMAGE_SLOTS.map(s => {
          const url = sess.images?.[s.id] || null;
          return e("label", { key: s.id, className: "image-slot" + (url ? " filled" : "") },
            url
              ? e(React.Fragment, null,
                  e("img", { src: url, alt: s.label }),
                  e("button", { className: "image-clear", onClick: ev => { ev.preventDefault(); onClear(s.id); } }, "×"),
                )
              : e("span", { className: "mono image-slot-empty" }, "+"),
            e("span", { className: "image-slot-label" }, s.label),
            e("input", { type: "file", accept: "image/*", style: { display: "none" }, onChange: ev => onPick(s.id, ev.target.files?.[0]) }),
          );
        }),
      ),
    ),
  );
}

// ===========================================================
// SETTINGS VIEW — the previous bridge configuration screen
// ===========================================================
function SettingsView({ snap, refresh }) {
  return e("div", { className: "layout" },
    e("div", { className: "col" },
      e(ServerCard, { snap, refresh }),
      e(DiscoveredCard, { snap, refresh }),
      e(InstrumentsCard, { snap, refresh }),
      e(NewInstrumentCard, { refresh }),
    ),
    e("div", { className: "col" },
      e(UploadQueueCard, { snap, refresh }),
      e(ActivityCard, { snap }),
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

function DiscoveredCard({ snap, refresh }) {
  const d = snap.discovery || {};
  const serial = d.serial || [];
  const rescan = async () => { await window.listener.rescanDiscovery(); refresh(); };
  const adopt = async (p) => {
    await window.listener.adoptSerial(p.path, { name: p.manufacturer ? `${p.manufacturer} (${p.path})` : p.path });
    refresh();
  };
  return e("div", { className: "card" },
    e("div", { className: "card-head" },
      e("span", { className: "card-title" }, "Auto-Discovery"),
      e("span", { className: "card-sub" },
        (d.lastScanAt ? "scanned " + fmtRel(d.lastScanAt) + " ago" : "not yet scanned") +
        " · " + serial.length + " serial candidate" + (serial.length === 1 ? "" : "s"),
      ),
      e("button", { className: "btn small ghost", style: { marginLeft: 8 }, onClick: rescan }, "Rescan"),
    ),
    e("div", { className: "card-body" },
      e("div", { className: "muted", style: { fontSize: 11.5, marginBottom: 10 } },
        d.inboxPath
          ? e("span", null, "Inbox watching ", e("span", { className: "mono" }, d.inboxPath),
              " — drop any IR Vision / Flash Point / Additives CSV here and it auto-uploads.")
          : "Inbox folder unavailable.",
      ),
      !d.serialSupported && e("div", { className: "muted", style: { fontSize: 11.5 } },
        "Serial discovery disabled — install ", e("span", { className: "mono" }, "serialport"),
        " in listener/ to enable USB-serial enumeration.",
      ),
      d.serialSupported && serial.length === 0 && e("div", { className: "empty", style: { padding: 12 } },
        "No new serial instruments detected. Plug in a USB-serial cable and click Rescan.",
      ),
      d.serialSupported && serial.length > 0 && e("div", null,
        serial.map(p =>
          e("div", { key: p.path, className: "instrument-row", style: { borderBottom: "1px solid var(--line)" } },
            e("span", { className: "dot unknown" }),
            e("div", null,
              e("div", { className: "instrument-name" }, p.path),
              e("div", { className: "instrument-meta" },
                [p.manufacturer, p.vendorId && p.productId ? p.vendorId + ":" + p.productId : null].filter(Boolean).join(" · ") || "unknown device",
                p.signature && " · " + p.signature,
              ),
            ),
            e("button", { className: "btn small primary", onClick: () => adopt(p) }, "Adopt"),
          ),
        ),
      ),
    ),
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

// ---- helpers ---------------------------------------------------------
function fmtVal(v) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}
function downsizeImage(file, maxW = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("invalid image"));
      img.onload = () => {
        const ratio = img.width > maxW ? maxW / img.width : 1;
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(e(App));
