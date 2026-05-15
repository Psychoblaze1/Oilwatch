// ============================================================
// Log Sample — scaffolded after the Lab88 sample_upload flow.
//
//   1. Site & Equipment   — cascading: Site → Location → Asset Type → Serial #
//   2. Sample Type & Draw — pick panel (Diesel CF1 / Piston Oil), draw date, etc.
//   3. Instrument Uploads — drop in IR Vision / Flash Point / Additives /
//                           Filter Patch files. The server-side parsers
//                           extract structured readings automatically.
//   4. Manual Readings    — only the params that no upload provides.
//   5. Comment            — free text. Surfaces in the PDF report.
//
// Submitting POSTs /api/samples with the merged readings plus the
// raw file contents so a reviewer can re-process if needed.
// ============================================================

function ScreenLogSample({ refresh, setRoute, focus }) {
  const today = new Date().toISOString().slice(0, 10);

  // --- Hierarchy state ---
  const [siteId,      setSiteId]      = React.useState(window.SITES[0]?.id || "");
  const [locationId,  setLocationId]  = React.useState("");
  const [assetTypeId, setAssetTypeId] = React.useState("");
  const [engineId,    setEngineId]    = React.useState("");
  const [newEngineMode, setNewEngineMode] = React.useState(false);
  const [newEngineName, setNewEngineName] = React.useState("");
  const [newEngineTag,  setNewEngineTag]  = React.useState("");

  // Reset child selects when a parent changes.
  React.useEffect(() => { setLocationId(""); setAssetTypeId(""); setEngineId(""); }, [siteId]);
  React.useEffect(() => { setAssetTypeId(""); setEngineId(""); }, [locationId]);
  React.useEffect(() => { setEngineId(""); }, [assetTypeId]);

  // --- Sample type + draw context ---
  const [typeId,    setTypeId]    = React.useState(window.SAMPLE_TYPES[0].id);
  const [drawnAt,   setDrawnAt]   = React.useState(today);
  const [priority,  setPriority]  = React.useState("STD");
  const [analyst,   setAnalyst]   = React.useState((window.CURRENT_USER && window.CURRENT_USER.name) || "Operator");
  const [component, setComponent] = React.useState("");
  const [noteText,  setNoteText]  = React.useState("");

  // --- Instrument file uploads + parsed readings ---
  // `readings[code] = { value, source }` where source ∈ {"ir","flash","add","manual"}.
  const [readings, setReadings] = React.useState({});
  const [irFile,    setIrFile]    = React.useState(null);   // {name, text, count}
  const [flashFile, setFlashFile] = React.useState(null);
  const [addFile,   setAddFile]   = React.useState(null);
  const [filterPatch, setFilterPatch] = React.useState(null);
  const [parseErr,  setParseErr]  = React.useState(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [error,      setError]      = React.useState(null);

  const sampleType = window.SAMPLE_TYPES.find(t => t.id === typeId) || window.SAMPLE_TYPES[0];
  const site       = window.SITES.find(s => s.id === siteId);
  const locations  = siteId ? window.getLocationsForSite(siteId) : [];
  const assetTypes = siteId ? window.getAssetTypesForSite(siteId, locationId || null) : [];
  const engines    = siteId ? window.getEnginesForAssetType(siteId, locationId || null, assetTypeId || null) : [];
  const engine     = engines.find(e => e.id === engineId);

  // Set the component default whenever the sample type changes.
  React.useEffect(() => { setComponent(sampleType.defaultComponent || ""); }, [typeId]);

  // ---- File parsing ----
  const handleParse = async (kind, file) => {
    if (!file) return;
    setParseErr(null);
    const text = await file.text();
    try {
      let out;
      if (kind === "ir")    out = await window.api.parseIrVision(text);
      if (kind === "flash") out = await window.api.parseFlashPoint(text);
      if (kind === "add")   out = await window.api.parseAdditives(text);
      const readingsArr = (out && out.readings) || [];
      const source = { ir: "ir", flash: "flash", add: "add" }[kind];
      setReadings(prev => {
        const next = { ...prev };
        for (const r of readingsArr) next[r.code] = { value: r.value, source };
        return next;
      });
      const meta = { name: file.name, text, count: readingsArr.length };
      if (kind === "ir")    setIrFile(meta);
      if (kind === "flash") setFlashFile(meta);
      if (kind === "add")   setAddFile(meta);
    } catch (e) {
      setParseErr(`${file.name}: ${e.message}`);
    }
  };
  const clearFile = (kind) => {
    const sourceTag = { ir: "ir", flash: "flash", add: "add" }[kind];
    setReadings(prev => {
      const next = {};
      for (const [c, r] of Object.entries(prev)) if (r.source !== sourceTag) next[c] = r;
      return next;
    });
    if (kind === "ir")    setIrFile(null);
    if (kind === "flash") setFlashFile(null);
    if (kind === "add")   setAddFile(null);
  };

  // ---- Param catalogue resolution ----
  // Codes the sample type cares about, in order. Anything not in
  // `readings` gets a manual-input row.
  const paramCodes = React.useMemo(() => {
    const codes = new Set();
    for (const instId of sampleType.instruments) {
      const inst = window.INSTRUMENTS.find(i => i.id === instId);
      if (!inst) continue;
      for (const c of inst.measures) codes.add(c);
    }
    return [...codes];
  }, [typeId]);
  const manualCodes = paramCodes.filter(c => !(c in readings));

  const setManual = (code, value) => {
    setReadings(prev => ({ ...prev, [code]: { value, source: "manual" } }));
  };
  const clearManual = (code) => {
    setReadings(prev => {
      const next = { ...prev }; delete next[code]; return next;
    });
  };

  // ---- Submit ----
  const onSubmit = async () => {
    if (!siteId)   { setError("Pick a site first.");                     return; }
    if (!engine && !newEngineMode) { setError("Pick equipment or register new."); return; }
    setError(null); setSubmitting(true);
    try {
      // Inline "register new equipment" path.
      let useEngineId = engineId;
      if (newEngineMode) {
        if (!newEngineName.trim() || !assetTypeId || !locationId) {
          throw new Error("Need location, asset type, and equipment name to register new.");
        }
        const created = await window.api.createEngine({
          siteId, locationId, assetTypeId,
          name: newEngineName.trim(), tag: newEngineTag.trim(),
          oem: null, oilName: null,
          health: 95, code: 1, runHours: 0, criticality: "C", rulDays: 120,
        });
        useEngineId = created.id;
        await window.bootstrap();
      }

      const results = Object.entries(readings)
        .filter(([, r]) => r.value !== "" && r.value != null)
        .map(([code, r]) => {
          const p = window.getParam(code);
          const isText = p && p.dir === "info" && p.code === "ISO4406";
          const value = isText ? String(r.value) : Number(r.value);
          return { code, value, source: r.source };
        });
      const anyResults = results.length > 0;

      const irData    = irFile    ? Object.fromEntries(results.filter(r => r.source === "ir").map(r => [r.code, r.value])) : null;
      const addData   = addFile   ? Object.fromEntries(results.filter(r => r.source === "add").map(r => [r.code, r.value])) : null;
      const flashData = flashFile ? results.find(r => r.code === "FlashPt")?.value ?? null : null;

      const sample = {
        assetId: useEngineId,
        component: component || sampleType.defaultComponent,
        oil: (engine?.oil?.name) || newEngineTag || "—",
        receivedAt: new Date(drawnAt).toISOString(),
        status: anyResults ? "QC" : "DRAFT",
        priority,
        score: deriveScore(readings, engine?.class),
        code:  window.scoreToCode(deriveScore(readings, engine?.class)),
        analyst,
        flags: derivedFlags(readings),
        results: anyResults ? results : null,
        sampleType: typeId,
        filterPatch: sampleType.acceptsFilterPatch ? filterPatch : null,
        note: noteText || null,
        irVisionData: irData,
        flashPointData: typeof flashData === "number" ? flashData : null,
        additivesData: addData,
        irVisionFile:   irFile?.text   ? `data:text/csv;base64,${btoa(unescape(encodeURIComponent(irFile.text)))}` : null,
        flashPointFile: flashFile?.text? `data:text/csv;base64,${btoa(unescape(encodeURIComponent(flashFile.text)))}` : null,
        additivesFile:  addFile?.text  ? `data:text/csv;base64,${btoa(unescape(encodeURIComponent(addFile.text)))}` : null,
      };

      const res = await window.api.createSample(sample);
      await window.bootstrap();
      refresh && refresh();
      focus && focus(res.id, "sample");
    } catch (e) {
      setError(e.message || String(e));
    } finally { setSubmitting(false); }
  };

  if (window.SITES.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><div><h1 className="page-title">Log Sample</h1></div></div>
        <div className="card"><div className="card-body" style={{ textAlign: "center", padding: 32 }}>
          No sites yet. Go to <button className="btn btn-sm" onClick={() => setRoute && setRoute("manage")}>Manage</button> and register a site + location + asset type first.
        </div></div>
      </div>
    );
  }

  const canSubmit = siteId && (engine || (newEngineMode && newEngineName.trim() && locationId && assetTypeId));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Sample</h1>
          <div className="page-sub">Pick the equipment, upload instrument files (parsers auto-fill readings), then submit.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setRoute && setRoute("samples")}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSubmit || submitting} onClick={onSubmit}>
            <Icon name="check" size={14}/> {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      {/* 1. Site & Equipment ----------------------------------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="card-title">Site & Equipment</span></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div>
            <div className="ls-label">Site</div>
            <select className="ls-input" value={siteId} onChange={e => setSiteId(e.target.value)}>
              <option value="">— Select —</option>
              {window.SITES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div className="ls-label">Location</div>
            <select className="ls-input" value={locationId} onChange={e => setLocationId(e.target.value)} disabled={!siteId}>
              <option value="">— Any —</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div>
            <div className="ls-label">Asset Type</div>
            <select className="ls-input" value={assetTypeId} onChange={e => setAssetTypeId(e.target.value)} disabled={!siteId}>
              <option value="">— Any —</option>
              {assetTypes.map(at => <option key={at.id} value={at.id}>{at.name}</option>)}
            </select>
          </div>
          <div>
            <div className="ls-label">Serial / Equipment</div>
            {newEngineMode ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input className="ls-input" placeholder="Name" value={newEngineName} onChange={e => setNewEngineName(e.target.value)} />
                <button className="btn btn-sm btn-ghost" onClick={() => setNewEngineMode(false)}>×</button>
              </div>
            ) : (
              <select className="ls-input" value={engineId} onChange={e => {
                if (e.target.value === "__new__") setNewEngineMode(true);
                else setEngineId(e.target.value);
              }} disabled={!siteId}>
                <option value="">— Select —</option>
                {engines.map(e => <option key={e.id} value={e.id}>{e.name}{e.tag ? ` · ${e.tag}` : ""}</option>)}
                <option value="__new__">+ Register new equipment</option>
              </select>
            )}
          </div>

          {newEngineMode && (
            <>
              <div style={{ gridColumn: "span 4", color: "var(--ink-3)", fontSize: 11.5 }}>
                Registering a new piece of equipment under <b>{site?.name}</b>
                {locationId && <> · <b>{locations.find(l => l.id === locationId)?.name}</b></>}
                {assetTypeId && <> · <b>{assetTypes.find(at => at.id === assetTypeId)?.name}</b></>}.
                Location and asset type must be set above.
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <div className="ls-label">Serial number / tag</div>
                <input className="ls-input" placeholder="QSK60-G4-0123" value={newEngineTag} onChange={e => setNewEngineTag(e.target.value)} />
              </div>
            </>
          )}

          {engine && !newEngineMode && (
            <div style={{ gridColumn: "span 4", display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--ink-2)" }}>
              <Icon name="info" size={12} style={{ color: "var(--ink-3)" }}/>
              Equipment context: {engine.oem || "—"} · {engine.classLabel || engine.assetTypeName || "—"} · {engine.runHours?.toLocaleString() || 0} hr · {engine.oil?.name || "—"}
            </div>
          )}
        </div>
      </div>

      {/* 2. Sample Type & Draw ---------------------------------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="card-title">Sample Type & Draw</span></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 14, alignItems: "end" }}>
          <div>
            <div className="ls-label">Sample type</div>
            <select className="ls-input" value={typeId} onChange={e => setTypeId(e.target.value)}>
              {window.SAMPLE_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4 }}>{sampleType.description}</div>
          </div>
          <div><div className="ls-label">Component</div><input className="ls-input" value={component} onChange={e => setComponent(e.target.value)} /></div>
          <div><div className="ls-label">Drawn</div><input type="date" className="ls-input" value={drawnAt} onChange={e => setDrawnAt(e.target.value)} /></div>
          <div>
            <div className="ls-label">Priority</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["STD","RUSH"].map(p => <button key={p} className={`btn btn-sm ${priority === p ? "btn-primary" : "btn-ghost"}`} onClick={() => setPriority(p)}>{p}</button>)}
            </div>
          </div>
          <div><div className="ls-label">Analyst</div><input className="ls-input" value={analyst} onChange={e => setAnalyst(e.target.value)} /></div>
        </div>
      </div>

      {/* 3. Instrument Uploads --------------------------------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Instrument Uploads</span>
          <span className="card-sub mono">DROP CSV FROM INSTRUMENT · SERVER AUTO-PARSES</span>
        </div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <UploadSlot label="IR Vision (.csv)" accept=".csv,.txt" file={irFile}
                      onPick={f => handleParse("ir", f)} onClear={() => clearFile("ir")}
                      hint="Density, Cetane, distillation T-points, CFPP, viscosity" />
          <UploadSlot label="Flash Point (.csv)" accept=".csv,.txt" file={flashFile}
                      onPick={f => handleParse("flash", f)} onClear={() => clearFile("flash")}
                      hint="Flash Point closed-cup result" />
          <UploadSlot label="Additives (.csv)" accept=".csv,.txt" file={addFile}
                      onPick={f => handleParse("add", f)} onClear={() => clearFile("add")}
                      hint="Elemental concentrations — S, Fe, Al, Mg, Zn, Pb, Si, Mn, V" />
          {sampleType.acceptsFilterPatch && (
            <PhotoSlot label="Filter Patch (image)" dataUrl={filterPatch} onPick={setFilterPatch}/>
          )}
        </div>
        {parseErr && <div className="card-body" style={{ paddingTop: 0, color: "var(--crit)", fontSize: 12 }}>Parse error: {parseErr}</div>}
      </div>

      {/* 4. Manual readings ----------------------------------- */}
      {manualCodes.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="card-title">Manual Readings</span>
            <span className="card-sub mono">{manualCodes.length} PARAMETER{manualCodes.length === 1 ? "" : "S"} NOT IN ANY UPLOAD</span>
          </div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {manualCodes.map(code => {
              const p = window.getParam(code);
              if (!p) return null;
              const isText = p.dir === "info" && p.code === "ISO4406";
              return (
                <div key={code} className="ls-param">
                  <div className="ls-param-head">
                    <span className="mono t-id">{code}</span>
                    <span className="ls-param-name">{p.name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input className="ls-input mono" type={isText ? "text" : "number"} step="any"
                           value={readings[code]?.value ?? ""}
                           onChange={e => e.target.value === "" ? clearManual(code) : setManual(code, e.target.value)}
                           placeholder={limitPlaceholder(p)} />
                    <span className="mono t-muted" style={{ fontSize: 11 }}>{p.unit}</span>
                  </div>
                  <div className="mono ls-param-lim">{limitDescription(p)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Already-parsed readings — quick reference / override */}
      {Object.keys(readings).length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-head">
            <span className="card-title">Captured Readings</span>
            <span className="card-sub mono">{Object.keys(readings).length} TOTAL</span>
          </div>
          <div className="card-body no-pad">
            <table className="table">
              <thead><tr><th>Code</th><th>Parameter</th><th style={{textAlign:"right"}}>Value</th><th>Source</th><th></th></tr></thead>
              <tbody>
                {Object.entries(readings).map(([code, r]) => {
                  const p = window.getParam(code);
                  return (
                    <tr key={code}>
                      <td className="mono t-id">{code}</td>
                      <td>{p?.name || code}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{r.value} {p?.unit || ""}</td>
                      <td><Tag tone={r.source === "manual" ? "neutral" : "accent"}>{sourceLabel(r.source)}</Tag></td>
                      <td style={{ textAlign: "right" }}>
                        <button className="btn btn-sm btn-ghost" onClick={() => clearManual(code)}><Icon name="close" size={11}/></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. Comment -------------------------------------------- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="card-title">Sample Comment</span></div>
        <div className="card-body">
          <textarea className="ls-input" rows={3}
                    placeholder="Any context worth preserving on the report"
                    value={noteText} onChange={e => setNoteText(e.target.value)} />
        </div>
      </div>

      {error && <div className="card" style={{ borderColor: "var(--crit)", color: "var(--crit)" }}>
        <div className="card-body">Error: {error}</div>
      </div>}

      <style>{`
        .ls-label { font-size: 10px; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; font-family: var(--mono); margin-bottom: 4px; }
        .ls-input { padding: 7px 10px; border-radius: 7px; background: var(--bg-sunken); border: 1px solid transparent; color: var(--ink); font-size: 13px; width: 100%; font-family: inherit; }
        .ls-input:focus { outline: 0; border-color: var(--accent-line); background: var(--bg-elev); }
        .ls-param { padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-elev); }
        .ls-param-head { display: flex; align-items: baseline; gap: 6px; margin-bottom: 6px; }
        .ls-param-name { font-size: 12px; color: var(--ink-2); }
        .ls-param-lim  { font-size: 10.5px; color: var(--ink-3); margin-top: 4px; letter-spacing: 0.04em; }
        .ls-drop { padding: 14px; border: 1px dashed var(--line); border-radius: 8px; background: var(--bg-elev); display: flex; flex-direction: column; gap: 8px; min-height: 110px; }
        .ls-drop.has-file { border-style: solid; border-color: var(--ok); background: rgba(47,125,79,0.04); }
        .ls-drop-title { font-size: 12px; font-weight: 600; }
        .ls-drop-hint { font-size: 11px; color: var(--ink-3); }
        .ls-pick { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 6px; background: var(--bg-sunken); cursor: pointer; font-size: 12px; }
        .ls-pick:hover { background: var(--bg); }
        .ls-file-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink); }
        .ls-file-name { font-family: var(--mono); color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
      `}</style>
    </div>
  );
}

function UploadSlot({ label, accept, file, onPick, onClear, hint }) {
  return (
    <div className={`ls-drop ${file ? "has-file" : ""}`}>
      <div className="ls-drop-title">{label}</div>
      <div className="ls-drop-hint">{hint}</div>
      {file ? (
        <div className="ls-file-row">
          <Icon name="check" size={12} style={{ color: "var(--ok)" }}/>
          <span className="ls-file-name" title={file.name}>{file.name}</span>
          <span className="mono t-muted" style={{ fontSize: 11 }}>· {file.count} reading{file.count === 1 ? "" : "s"}</span>
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: "auto" }} onClick={onClear}>Remove</button>
        </div>
      ) : (
        <label className="ls-pick">
          <Icon name="plus" size={11}/> Choose file
          <input type="file" accept={accept} style={{ display: "none" }} onChange={e => onPick(e.target.files?.[0])}/>
        </label>
      )}
    </div>
  );
}

function PhotoSlot({ label, dataUrl, onPick }) {
  const onChange = async (file) => {
    if (!file) return;
    const url = await downsizeImage(file, 800, 0.82);
    onPick(url);
  };
  return (
    <div className={`ls-drop ${dataUrl ? "has-file" : ""}`}>
      <div className="ls-drop-title">{label}</div>
      <div className="ls-drop-hint">Photo of the gravimetric filter patch. Auto-resized to 800 px.</div>
      {dataUrl ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <img src={dataUrl} alt="Filter patch preview" style={{ height: 70, borderRadius: 4, border: "1px solid var(--line)" }} />
          <button className="btn btn-sm btn-ghost" onClick={() => onPick(null)}>Remove</button>
        </div>
      ) : (
        <label className="ls-pick">
          <Icon name="plus" size={11}/> Choose image
          <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => onChange(e.target.files?.[0])}/>
        </label>
      )}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function sourceLabel(src) {
  return src === "ir" ? "IR Vision" : src === "flash" ? "Flash Point" : src === "add" ? "Additives" : "Manual";
}

// Approximate score driven by how many readings exceed their limits.
function deriveScore(readings, assetClass) {
  const limits = window.getLimits(assetClass);
  let penalty = 0;
  for (const [code, r] of Object.entries(readings)) {
    const v = Number(r.value);
    if (!isFinite(v)) continue;
    const lim = limits[code];
    if (lim) {
      if (typeof lim.alarm === "number" && v >= lim.alarm) penalty += 18;
      else if (typeof lim.warn === "number" && v >= lim.warn) penalty += 8;
      if (code === "Visc100" && lim.target) {
        const dev = Math.abs(v - lim.target) / lim.target;
        if (dev > 0.15) penalty += 18;
        else if (dev > 0.10) penalty += 8;
      }
    }
    const dp = window.getParam(code);
    if (dp && dp.paramSet === "diesel" && dp.dir !== "info") {
      const status = window.evalDieselStatus(dp, v);
      if (status === "fail") penalty += 16;
    }
  }
  return Math.max(4, Math.min(99, 95 - penalty));
}

function derivedFlags(readings) {
  const flags = [];
  const v = code => Number(readings[code]?.value);
  if (v("Fe") >= 35)   flags.push("Fe↑");
  if (v("Cr") >= 5)    flags.push("Cr↑");
  if (v("Al") >= 8)    flags.push("Al↑");
  if (v("H2O") >= 200) flags.push("H₂O");
  if (v("Fuel") >= 2)  flags.push("Fuel%");
  if (v("Si") >= 15)   flags.push("Si↑");
  return flags;
}

function limitDescription(p) {
  if (!p) return "—";
  if (p.dir === "min")   return `min ${p.min}${p.unit ? " " + p.unit : ""}`;
  if (p.dir === "max")   return `max ${p.max}${p.unit ? " " + p.unit : ""}`;
  if (p.dir === "range") return `${p.min} – ${p.max}${p.unit ? " " + p.unit : ""}`;
  if (typeof p.warn === "number" || typeof p.alarm === "number") return `warn ${p.warn} · alarm ${p.alarm}`;
  return "informational only";
}
function limitPlaceholder(p) {
  if (!p) return "—";
  if (p.dir === "min")   return `≥ ${p.min}`;
  if (p.dir === "max")   return `≤ ${p.max}`;
  if (p.dir === "range") return `${p.min}–${p.max}`;
  if (typeof p.warn === "number") return `< ${p.warn}`;
  return "—";
}

function downsizeImage(file, maxW = 800, quality = 0.82) {
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

window.ScreenLogSample = ScreenLogSample;
