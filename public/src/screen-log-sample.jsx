// ============================================================
// Log Sample workflow
//
// Pick a sample type → pick the aircraft engine → fill in each
// required instrument's readings → submit. The instrument list
// per sample type comes from window.SAMPLE_TYPES / window.INSTRUMENTS
// in data.jsx, so adding new instruments (Spectro Q5800, new MiniLab,
// etc.) is a one-place edit. Future "auto-upload" integrations would
// pre-fill instrument fields by POSTing here from a watcher process.
// ============================================================

function ScreenLogSample({ refresh, setRoute, focus }) {
  const today = new Date().toISOString().slice(0, 10);
  const [typeId, setTypeId]   = React.useState(window.SAMPLE_TYPES[0].id);
  const [engineId, setEngine] = React.useState(window.ASSETS[0]?.id || "");
  const [drawnAt, setDrawnAt] = React.useState(today);
  const [oilHours, setOilHours] = React.useState("");      // hours since last oil change
  const [component, setComponent] = React.useState("");
  const [priority, setPriority] = React.useState("STD");
  const [analyst, setAnalyst]   = React.useState("D. Vaughn");
  const [readings, setReadings] = React.useState({});       // { paramCode: { value, instrumentId } }
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null);

  const sampleType = window.SAMPLE_TYPES.find(t => t.id === typeId);
  const instruments = sampleType.instruments.map(id => window.INSTRUMENTS.find(i => i.id === id)).filter(Boolean);
  const engine = window.ASSETS.find(a => a.id === engineId);

  // Set component default to whatever the picked sample type wants.
  React.useEffect(() => {
    if (!component) setComponent(sampleType.defaultComponent);
  }, [typeId]);

  const setReading = (paramCode, instrumentId, value) => {
    setReadings(r => ({ ...r, [paramCode]: { value, instrumentId } }));
  };

  const score = React.useMemo(() => deriveScore(readings, engine?.class), [readings, engine]);
  const code  = window.scoreToCode(score);

  const onSubmit = async () => {
    setError(null); setSubmitting(true);
    try {
      // Pack instrument readings into the wire shape the server expects.
      const results = Object.entries(readings)
        .filter(([, r]) => r.value !== "" && r.value != null)
        .map(([code, r]) => ({ code, value: Number(r.value), instrument: r.instrumentId }));
      const anyResults = results.length > 0;
      const sample = {
        assetId: engine.id,
        component: component || sampleType.defaultComponent,
        oil: engine.oil?.name || "—",
        receivedAt: new Date(drawnAt).toISOString(),
        status: anyResults ? "QC" : "DRAFT",
        priority,
        score, code,
        analyst,
        flags: derivedFlags(readings),
        results: anyResults ? results : null,
      };
      const res = await window.api.createSample(sample);
      // Refresh by re-running bootstrap so SAMPLES updates with the new row.
      await window.bootstrap();
      refresh && refresh();
      focus && focus(res.id, "sample");
    } catch (e) {
      setError(e.message || String(e));
    } finally { setSubmitting(false); }
  };

  if (!engine) {
    return <div className="page"><div className="page-sub">No engines in the fleet yet.</div></div>;
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Sample</h1>
          <div className="page-sub">Pick a sample type, the engine, and key in the instrument readings. Submit drops the sample into the QC queue.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setRoute && setRoute("samples")}>Cancel</button>
          <button className="btn btn-primary" disabled={submitting} onClick={onSubmit}>
            <Icon name="check" size={14}/> {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head"><span className="card-title">Sample Type</span></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {window.SAMPLE_TYPES.map(t => (
              <button key={t.id} className={`type-card ${typeId === t.id ? "is-active" : ""}`} onClick={() => setTypeId(t.id)}>
                <div className="type-name">{t.label}</div>
                <div className="type-sub">{t.description}</div>
                <div className="mono type-instr">
                  {t.instruments.map(id => window.INSTRUMENTS.find(i => i.id === id)?.name).filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Engine &amp; Draw</span></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: "10px 14px", fontSize: 12.5 }}>
            <div className="muted">Engine</div>
            <select className="ls-input" value={engineId} onChange={e => setEngine(e.target.value)}>
              {window.ASSETS.slice().sort((a,b) => a.siteName.localeCompare(b.siteName) || a.name.localeCompare(b.name)).map(a => (
                <option key={a.id} value={a.id}>{a.name} · {a.tag} · {a.siteName}</option>
              ))}
            </select>

            <div className="muted">Component</div>
            <input className="ls-input" value={component} placeholder={sampleType.defaultComponent}
                   onChange={e => setComponent(e.target.value)} />

            <div className="muted">Drawn</div>
            <input className="ls-input" type="date" value={drawnAt} onChange={e => setDrawnAt(e.target.value)} />

            <div className="muted">Hours since last oil change</div>
            <input className="ls-input" type="number" min="0" step="0.1" placeholder="25.0"
                   value={oilHours} onChange={e => setOilHours(e.target.value)} />

            <div className="muted">Priority</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["STD","RUSH"].map(p => (
                <button key={p} className={`btn btn-sm ${priority === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setPriority(p)}>{p}</button>
              ))}
            </div>

            <div className="muted">Analyst</div>
            <input className="ls-input" value={analyst} onChange={e => setAnalyst(e.target.value)} />

            <div className="muted">Engine context</div>
            <div className="mono" style={{ color: "var(--ink-2)", fontSize: 11.5 }}>
              {engine.classLabel} · {engine.oem} · {engine.runHours.toLocaleString()} hr TSMOH · {engine.oil?.name}
            </div>
          </div>
        </div>
      </div>

      {/* One card per instrument, holding its parameter inputs. */}
      {instruments.map(inst => {
        const params = inst.measures.map(code => window.PARAM_DEFS.find(p => p.code === code)).filter(Boolean);
        return (
          <div key={inst.id} className="card" style={{ marginBottom: 16 }}>
            <div className="card-head">
              <span className="card-title">{inst.name}</span>
              <span className="card-sub mono">{inst.brand.toUpperCase()} · {inst.type.toUpperCase()}</span>
            </div>
            <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
              {params.map(p => (
                <div key={p.code} className="ls-param">
                  <div className="ls-param-head">
                    <span className="mono t-id">{p.code}</span>
                    <span className="ls-param-name">{p.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input className="ls-input mono" type="number" step="any"
                           value={readings[p.code]?.value ?? ""}
                           onChange={e => setReading(p.code, inst.id, e.target.value)}
                           placeholder={typeof p.warn === "number" ? `< ${p.warn}` : "—"} />
                    <span className="mono t-muted" style={{ fontSize: 11 }}>{p.unit}</span>
                  </div>
                  <div className="mono ls-param-lim">
                    warn {p.warn} · alarm {p.alarm}
                  </div>
                </div>
              ))}
            </div>
            <div className="card-body" style={{ paddingTop: 0, fontSize: 11.5, color: "var(--ink-3)" }}>
              {inst.notes}
            </div>
          </div>
        );
      })}

      {/* Derived preview */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Preview</span>
          <span className="card-sub mono">DERIVED FROM ENTRIES</span>
        </div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.1 }}>HEALTH SCORE</div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{score}</div>
          </div>
          <Chip code={code}>{window.COND[code].label.toUpperCase()}</Chip>
          <div className="mono" style={{ marginLeft: "auto", color: "var(--ink-3)" }}>
            {Object.keys(readings).length} parameter{Object.keys(readings).length === 1 ? "" : "s"} entered ·
            status will be {Object.keys(readings).length ? <b>QC</b> : <b>DRAFT</b>}
          </div>
        </div>
        {error && <div className="card-body" style={{ paddingTop: 0, color: "var(--crit)", fontSize: 12.5 }}>Error: {error}</div>}
      </div>

      <style>{`
        .type-card { text-align: left; padding: 12px 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-elev); cursor: pointer; }
        .type-card:hover { border-color: var(--accent-line); }
        .type-card.is-active { border-color: var(--accent); background: var(--accent-soft); }
        .type-name { font-size: 13px; font-weight: 500; }
        .type-sub  { font-size: 12px; color: var(--ink-3); margin-top: 3px; }
        .type-instr { font-size: 10.5px; color: var(--ink-3); margin-top: 6px; letter-spacing: 0.04em; }
        .ls-input  { padding: 7px 10px; border-radius: 7px; background: var(--bg-sunken); border: 1px solid transparent; color: var(--ink); font-size: 13px; width: 100%; }
        .ls-input:focus { outline: 0; border-color: var(--accent-line); background: var(--bg-elev); }
        .ls-param { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-elev); }
        .ls-param-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
        .ls-param-name { font-size: 12px; color: var(--ink-2); }
        .ls-param-lim  { font-size: 10.5px; color: var(--ink-3); margin-top: 4px; letter-spacing: 0.04em; }
      `}</style>
    </div>
  );
}

// Crude scoring derived from how many readings exceed warn/alarm.
// Pure / local — server doesn't re-derive on its own.
function deriveScore(readings, assetClass) {
  const limits = window.getLimits(assetClass);
  let penalty = 0;
  for (const [code, r] of Object.entries(readings)) {
    const v = Number(r.value);
    if (!isFinite(v)) continue;
    const lim = limits[code];
    if (!lim) continue;
    if (typeof lim.alarm === "number" && v >= lim.alarm) penalty += 18;
    else if (typeof lim.warn === "number" && v >= lim.warn) penalty += 8;
    if (code === "Visc100" && lim.target) {
      const dev = Math.abs(v - lim.target) / lim.target;
      if (dev > 0.15) penalty += 18;
      else if (dev > 0.10) penalty += 8;
    }
  }
  return Math.max(4, Math.min(99, 95 - penalty));
}

function derivedFlags(readings) {
  const flags = [];
  const v = code => Number(readings[code]?.value);
  if (v("Fe") >= 35) flags.push("Fe↑");
  if (v("Cr") >= 5)  flags.push("Cr↑");
  if (v("Al") >= 8)  flags.push("Al↑");
  if (v("H2O") >= 200) flags.push("H₂O");
  if (v("Fuel") >= 2) flags.push("Fuel%");
  if (v("Si") >= 15)  flags.push("Si↑");
  return flags;
}

window.ScreenLogSample = ScreenLogSample;
