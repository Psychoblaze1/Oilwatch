// ============================================================
// Log Sample — 5-step wizard.
//
//   Step 1 · Sample type ............ pick which panel to run
//   Step 2 · Pick the equipment ..... cascade Site → Loc → Type → Eq
//   Step 3 · Bring in the data ...... instrument file uploads
//   Step 4 · Fill in the gaps ....... manual readings the files miss
//   Step 5 · Review & submit ........ draw date / priority / analyst
//
// Submitting POSTs /api/samples with the merged readings plus the
// raw file contents so a reviewer can re-process if needed.
// ============================================================

function ScreenLogSample({ section, refresh, setRoute, focus, routeArg, consumeRouteArg }) {
  const sec = section || "oil";
  const today = new Date().toISOString().slice(0, 10);
  const sectionSampleTypes = window.getSampleTypesForSection(sec);

  // --- Wizard state -----------------------------------------------------
  const [step, setStep] = React.useState(0);

  // --- Step 1: sample type ---------------------------------------------
  const [typeId, setTypeId] = React.useState((sectionSampleTypes[0] || window.SAMPLE_TYPES[0]).id);
  React.useEffect(() => {
    if (!sectionSampleTypes.find(t => t.id === typeId)) {
      setTypeId((sectionSampleTypes[0] || window.SAMPLE_TYPES[0]).id);
    }
  }, [sec]);
  const sampleType = window.SAMPLE_TYPES.find(t => t.id === typeId) || window.SAMPLE_TYPES[0];

  // --- Step 2: hierarchy + equipment ----------------------------------
  const [siteId, setSiteId]           = React.useState(window.SITES[0]?.id || "");
  const [locationId, setLocationId]   = React.useState("");
  const [assetTypeId, setAssetTypeId] = React.useState("");
  const [engineId, setEngineId]       = React.useState("");
  const [samplingPointId, setSamplingPointId] = React.useState("");
  const [newEngineMode, setNewEngineMode]   = React.useState(false);
  const [newEngineName, setNewEngineName]   = React.useState("");
  const [newEngineTag, setNewEngineTag]     = React.useState("");
  React.useEffect(() => { setLocationId(""); setAssetTypeId(""); setEngineId(""); setSamplingPointId(""); }, [siteId]);
  React.useEffect(() => { setAssetTypeId(""); setEngineId(""); setSamplingPointId(""); }, [locationId]);
  React.useEffect(() => { setEngineId(""); setSamplingPointId(""); }, [assetTypeId]);
  React.useEffect(() => { setSamplingPointId(""); }, [engineId]);

  // Preselect path: when the user came in from Asset → "New sample",
  // hydrate the cascade with that engine's site/loc/type/id and skip
  // straight to the data-entry step. Run once on mount.
  React.useEffect(() => {
    const arg = consumeRouteArg ? consumeRouteArg() : (routeArg || null);
    if (!arg || !arg.preselectAssetId) return;
    const eng = window.ASSETS.find(a => a.id === arg.preselectAssetId);
    if (!eng) return;
    setSiteId(eng.site || "");
    setTimeout(() => {
      setLocationId(eng.locationId || "");
      setAssetTypeId(eng.assetTypeId || "");
      setEngineId(eng.id);
      setStep(2);
    }, 0);
  }, []);

  const site       = window.SITES.find(s => s.id === siteId);
  const locations  = siteId ? window.getLocationsForSite(siteId) : [];
  const assetTypes = siteId ? window.getAssetTypesForSite(siteId, locationId || null) : [];
  const engines    = siteId ? window.getEnginesForAssetType(siteId, locationId || null, assetTypeId || null) : [];
  const engine     = engines.find(e => e.id === engineId);

  // --- Step 3: file uploads + parsed readings -------------------------
  const [readings, setReadings]     = React.useState({});
  const [irFile, setIrFile]         = React.useState(null);
  const [flashFile, setFlashFile]   = React.useState(null);
  const [addFile, setAddFile]       = React.useState(null);
  const [filterPatch, setFilterPatch] = React.useState(null);
  const [parseErr, setParseErr]     = React.useState(null);

  // --- Step 5: meta + submit -----------------------------------------
  const [drawnAt, setDrawnAt]     = React.useState(today);
  const [priority, setPriority]   = React.useState("STD");
  const [analyst, setAnalyst]     = React.useState((window.CURRENT_USER && window.CURRENT_USER.name) || "Operator");
  const [component, setComponent] = React.useState("");
  const [noteText, setNoteText]   = React.useState("");
  React.useEffect(() => { setComponent(sampleType.defaultComponent || ""); }, [typeId]);

  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError]           = React.useState(null);

  // ---- File parsing --------------------------------------------------
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

  // ---- Param catalogue resolution ------------------------------------
  // Codes the sample type cares about, in order. Anything not in
  // `readings` gets a manual-input row on step 4.
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

  const setManual   = (code, value) => setReadings(prev => ({ ...prev, [code]: { value, source: "manual" } }));
  const clearReading = (code) => setReadings(prev => { const n = { ...prev }; delete n[code]; return n; });

  // ---- Step validation -----------------------------------------------
  const stepErrors = (i) => {
    if (i === 0) {
      if (!typeId) return "Pick a sample type to continue.";
    }
    if (i === 1) {
      if (!siteId) return "Pick a site.";
      if (newEngineMode) {
        if (!locationId)           return "Pick a location for the new equipment.";
        if (!assetTypeId)          return "Pick an asset type for the new equipment.";
        if (!newEngineName.trim()) return "Name the new piece of equipment.";
      } else if (!engineId) {
        return "Pick a piece of equipment (or choose Register new).";
      }
    }
    // Steps 2 (uploads) and 3 (manual) have no hard prereqs — they're
    // optional. Submit on step 4 will block if nothing useful was added.
    return null;
  };
  const canAdvance = !stepErrors(step);

  // ---- Submit --------------------------------------------------------
  const onSubmit = async () => {
    setError(null); setSubmitting(true);
    try {
      let useEngineId = engineId;
      if (newEngineMode) {
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

      // Sampling-point name takes precedence over the free-text
      // component field when one is registered + selected.
      const samplingPoint = engine?.samplingPoints?.find(sp => sp.id === samplingPointId) || null;
      const sample = {
        assetId: useEngineId,
        samplingPointId: samplingPointId || null,
        component: samplingPoint ? samplingPoint.name : (component || sampleType.defaultComponent),
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

  // ---- Empty-fleet shortcut -----------------------------------------
  if (window.SITES.length === 0) {
    return (
      <div className="page">
        <div className="page-header"><div><h1 className="page-title">Log Sample</h1></div></div>
        <div className="card"><div className="card-body" style={{ textAlign: "center", padding: 32 }}>
          No sites yet. Open <button className="btn btn-sm" onClick={() => setRoute && setRoute("manage")}>Manage</button> and register a site + location + asset type first.
        </div></div>
      </div>
    );
  }

  // ---- Render --------------------------------------------------------
  const STEPS = [
    { key: "type",   label: "Sample type" },
    { key: "equip",  label: "Equipment"   },
    { key: "data",   label: "Instrument data" },
    { key: "manual", label: "Manual readings" },
    { key: "review", label: "Review & submit" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Log Sample</h1>
          <div className="page-sub">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => setRoute && setRoute("samples")}>Cancel</button>
        </div>
      </div>

      <WizardSteps steps={STEPS} current={step} onPick={(i) => i <= step + 1 && setStep(Math.min(i, step))} />

      {step === 0 && (
        <StepSampleType
          sec={sec}
          sectionSampleTypes={sectionSampleTypes}
          typeId={typeId} setTypeId={setTypeId} />
      )}

      {step === 1 && (
        <StepEquipment
          siteId={siteId} setSiteId={setSiteId}
          locationId={locationId} setLocationId={setLocationId}
          assetTypeId={assetTypeId} setAssetTypeId={setAssetTypeId}
          engineId={engineId} setEngineId={setEngineId}
          samplingPointId={samplingPointId} setSamplingPointId={setSamplingPointId}
          newEngineMode={newEngineMode} setNewEngineMode={setNewEngineMode}
          newEngineName={newEngineName} setNewEngineName={setNewEngineName}
          newEngineTag={newEngineTag} setNewEngineTag={setNewEngineTag}
          site={site} locations={locations} assetTypes={assetTypes} engines={engines} engine={engine} />
      )}

      {step === 2 && (
        <StepInstruments
          sampleType={sampleType}
          irFile={irFile} flashFile={flashFile} addFile={addFile} filterPatch={filterPatch}
          setFilterPatch={setFilterPatch}
          onParse={handleParse} onClear={clearFile}
          parseErr={parseErr} />
      )}

      {step === 3 && (
        <StepManual
          paramCodes={paramCodes} readings={readings}
          manualCodes={manualCodes}
          onCommit={setManual} onClear={clearReading} />
      )}

      {step === 4 && (
        <StepReview
          sec={sec}
          sampleType={sampleType}
          engine={engine} newEngineMode={newEngineMode} newEngineName={newEngineName} newEngineTag={newEngineTag}
          readings={readings}
          drawnAt={drawnAt} setDrawnAt={setDrawnAt}
          priority={priority} setPriority={setPriority}
          analyst={analyst} setAnalyst={setAnalyst}
          component={component} setComponent={setComponent}
          noteText={noteText} setNoteText={setNoteText}
          irFile={irFile} flashFile={flashFile} addFile={addFile} filterPatch={filterPatch}
          onClearReading={clearReading} />
      )}

      {error && <div className="card" style={{ borderColor: "var(--crit)", marginTop: 16 }}>
        <div className="card-body" style={{ color: "var(--crit)" }}>Error: {error}</div>
      </div>}

      {/* Bottom nav */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18, gap: 12 }}>
        <button className="btn btn-ghost" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>
          <Icon name="chevron-l" size={12}/> Back
        </button>
        <div style={{ flex: 1, textAlign: "right" }}>
          {stepErrors(step) && (
            <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginRight: 10 }}>
              {stepErrors(step)}
            </span>
          )}
          {step < STEPS.length - 1 ? (
            <button className="btn btn-primary" disabled={!canAdvance} onClick={() => setStep(s => s + 1)}>
              Next <Icon name="chevron-r" size={12}/>
            </button>
          ) : (
            <button className="btn btn-primary" disabled={submitting} onClick={onSubmit}>
              <Icon name="check" size={14}/> {submitting ? "Submitting…" : "Submit sample"}
            </button>
          )}
        </div>
      </div>

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

        .wizard-steps { display: flex; gap: 4px; margin-bottom: 22px; }
        .wizard-step { flex: 1; padding: 10px 12px; border-radius: 8px; background: var(--bg-elev); border: 1px solid var(--line); display: flex; align-items: center; gap: 10px; font-size: 12.5px; color: var(--ink-3); cursor: default; text-align: left; }
        .wizard-step.is-active { border-color: var(--accent); color: var(--ink); background: var(--bg); }
        .wizard-step.is-done { color: var(--ink-2); border-color: var(--line); cursor: pointer; }
        .wizard-step.is-done:hover { background: var(--bg-sunken); }
        .wizard-step .wz-n { width: 22px; height: 22px; border-radius: 50%; background: var(--bg-sunken); display: grid; place-items: center; font-size: 11px; font-family: var(--mono); }
        .wizard-step.is-active .wz-n { background: var(--accent); color: #fff; }
        .wizard-step.is-done .wz-n { background: var(--ok-bg); color: var(--ok); }

        .type-pick-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }
        .type-card { padding: 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-elev); text-align: left; cursor: pointer; }
        .type-card:hover { border-color: var(--accent-line); }
        .type-card.is-selected { border-color: var(--accent); background: var(--accent-soft); }
        .type-card .tc-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
        .type-card .tc-desc { font-size: 12px; color: var(--ink-2); line-height: 1.45; }
        .type-card .tc-meta { font-size: 10.5px; color: var(--ink-3); margin-top: 8px; letter-spacing: 0.05em; font-family: var(--mono); text-transform: uppercase; }
      `}</style>
    </div>
  );
}

// ============================================================
// Step indicator strip
// ============================================================
function WizardSteps({ steps, current, onPick }) {
  return (
    <div className="wizard-steps">
      {steps.map((s, i) => {
        const cls = i === current ? "is-active" : (i < current ? "is-done" : "");
        return (
          <button key={s.key} className={`wizard-step ${cls}`} onClick={() => i <= current && onPick(i)}>
            <span className="wz-n">{i < current ? <Icon name="check" size={12}/> : i + 1}</span>
            <span>{s.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================
// Step 1 — Sample type
// ============================================================
function StepSampleType({ sec, sectionSampleTypes, typeId, setTypeId }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">What kind of sample is this?</span>
        <span className="card-sub mono">{sec === "diesel" ? "DIESEL FUEL" : "OIL"} SECTION</span>
      </div>
      <div className="card-body">
        <div className="type-pick-grid">
          {sectionSampleTypes.map(t => (
            <button key={t.id} className={`type-card ${t.id === typeId ? "is-selected" : ""}`} onClick={() => setTypeId(t.id)}>
              <div className="tc-title">{t.label}</div>
              <div className="tc-desc">{t.description}</div>
              <div className="tc-meta">{(t.instruments || []).length} instrument{(t.instruments || []).length === 1 ? "" : "s"} · default component "{t.defaultComponent || "—"}"</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step 2 — Equipment cascade
// ============================================================
function StepEquipment(p) {
  const {
    siteId, setSiteId, locationId, setLocationId, assetTypeId, setAssetTypeId,
    engineId, setEngineId, samplingPointId, setSamplingPointId,
    newEngineMode, setNewEngineMode,
    newEngineName, setNewEngineName, newEngineTag, setNewEngineTag,
    site, locations, assetTypes, engines, engine,
  } = p;
  const samplingPoints = engine?.samplingPoints || [];
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">Pick the equipment</span></div>
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
          <div className="ls-label">Equipment / serial</div>
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
          <div style={{ gridColumn: "span 4", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "center" }}>
            <div>
              <div className="ls-label">Sampling point</div>
              <select className="ls-input" value={samplingPointId} onChange={e => setSamplingPointId && setSamplingPointId(e.target.value)} disabled={samplingPoints.length === 0}>
                <option value="">{samplingPoints.length === 0 ? "— No points registered (free text below) —" : "— Select a registered point —"}</option>
                {samplingPoints.map(sp => <option key={sp.id} value={sp.id}>{sp.name}{sp.kind ? ` · ${sp.kind}` : ""}</option>)}
              </select>
              {samplingPoints.length === 0 && (
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4 }}>
                  Register sampling points on this engine under Manage to pick from a dropdown.
                </div>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 12, color: "var(--ink-2)" }}>
              <Icon name="info" size={12} style={{ color: "var(--ink-3)" }}/>
              {engine.oem || "—"} · {engine.classLabel || engine.assetTypeName || "—"} · {engine.runHours?.toLocaleString() || 0} hr · {engine.oil?.name || "—"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 3 — Instrument uploads
// ============================================================
function StepInstruments(p) {
  const { sampleType, irFile, flashFile, addFile, filterPatch, setFilterPatch, onParse, onClear, parseErr } = p;
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Bring in the instrument data</span>
        <span className="card-sub mono">OPTIONAL · DROP CSV FROM INSTRUMENT — SERVER AUTO-PARSES</span>
      </div>
      <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <UploadSlot label="IR Vision (.csv)" accept=".csv,.txt" file={irFile}
                    onPick={f => onParse("ir", f)} onClear={() => onClear("ir")}
                    hint="Density, Cetane, distillation T-points, CFPP, viscosity" />
        <UploadSlot label="Flash Point (.csv)" accept=".csv,.txt" file={flashFile}
                    onPick={f => onParse("flash", f)} onClear={() => onClear("flash")}
                    hint="Flash Point closed-cup result" />
        <UploadSlot label="Additives / Elemental (.csv)" accept=".csv,.txt" file={addFile}
                    onPick={f => onParse("add", f)} onClear={() => onClear("add")}
                    hint="Elemental concentrations — S, Fe, Al, Mg, Zn, Pb, Si, Mn, V" />
        {sampleType.acceptsFilterPatch && (
          <PhotoSlot label="Filter Patch (image)" dataUrl={filterPatch} onPick={setFilterPatch}/>
        )}
      </div>
      <div className="card-body" style={{ paddingTop: 0, color: "var(--ink-3)", fontSize: 11.5 }}>
        Skip this step if you don't have instrument files — you can enter every reading by hand on the next step.
      </div>
      {parseErr && <div className="card-body" style={{ paddingTop: 0, color: "var(--crit)", fontSize: 12 }}>Parse error: {parseErr}</div>}
    </div>
  );
}

// ============================================================
// Step 4 — Manual readings
// ============================================================
function StepManual({ paramCodes, manualCodes, readings, onCommit, onClear }) {
  if (paramCodes.length === 0) {
    return (
      <div className="card">
        <div className="card-body" style={{ textAlign: "center", padding: 24, color: "var(--ink-3)" }}>
          This sample type has no instrument-driven parameters. Submit on the next step or pick a different type.
        </div>
      </div>
    );
  }
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Fill in any readings the files missed</span>
        <span className="card-sub mono">{manualCodes.length} REMAINING · {Object.keys(readings).length} CAPTURED</span>
      </div>
      <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {manualCodes.map(code => {
          const p = window.getParam(code);
          if (!p) return null;
          return (
            <ManualReadingInput key={code} param={p}
                                onCommit={(v) => onCommit(code, v)}
                                onClear={() => onClear(code)} />
          );
        })}
        {manualCodes.length === 0 && (
          <div style={{ gridColumn: "1/-1", textAlign: "center", color: "var(--ink-3)", padding: 18 }}>
            All parameters for this sample type are filled. Move to Review.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Step 5 — Review & submit
// ============================================================
function StepReview(p) {
  const {
    sec, sampleType, engine, newEngineMode, newEngineName, newEngineTag,
    readings, drawnAt, setDrawnAt, priority, setPriority, analyst, setAnalyst,
    component, setComponent, noteText, setNoteText,
    irFile, flashFile, addFile, filterPatch, onClearReading,
  } = p;
  const fileCount = [irFile, flashFile, addFile, filterPatch].filter(Boolean).length;
  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="card-title">Sample meta</span></div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 14, alignItems: "end" }}>
          <div>
            <div className="ls-label">Sample type</div>
            <div style={{ fontSize: 13 }}>{sampleType.label}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4 }}>{sampleType.description}</div>
          </div>
          <div><div className="ls-label">Component</div><input className="ls-input" value={component} onChange={e => setComponent(e.target.value)} /></div>
          <div><div className="ls-label">Drawn</div><input type="date" className="ls-input" value={drawnAt} onChange={e => setDrawnAt(e.target.value)} /></div>
          <div>
            <div className="ls-label">Priority</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["STD","RUSH"].map(x => <button key={x} className={`btn btn-sm ${priority === x ? "btn-primary" : "btn-ghost"}`} onClick={() => setPriority(x)}>{x}</button>)}
            </div>
          </div>
          <div><div className="ls-label">Analyst</div><input className="ls-input" value={analyst} onChange={e => setAnalyst(e.target.value)} /></div>
          <div style={{ gridColumn: "span 3", fontSize: 12, color: "var(--ink-3)" }}>
            <Icon name="info" size={11} style={{ marginRight: 4 }}/>
            Equipment: {newEngineMode
              ? <b>{newEngineName} ({newEngineTag || "tag t.b.d."})</b>
              : <b>{engine?.name || "—"} · {engine?.tag || "—"}</b>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Captured Readings</span>
          <span className="card-sub mono">{Object.keys(readings).length} · {fileCount} FILE{fileCount === 1 ? "" : "S"}</span>
        </div>
        <div className="card-body no-pad">
          {Object.keys(readings).length === 0 ? (
            <div style={{ padding: 18, textAlign: "center", color: "var(--ink-3)" }}>
              No readings captured yet. You can still submit a DRAFT and add results later.
            </div>
          ) : (
            <table className="table">
              <thead><tr><th>Code</th><th>Parameter</th><th style={{ textAlign: "right" }}>Value</th><th>Source</th><th></th></tr></thead>
              <tbody>
                {Object.entries(readings).map(([code, r]) => {
                  const def = window.getParam(code);
                  return (
                    <tr key={code}>
                      <td className="mono t-id">{code}</td>
                      <td>{def?.name || code}</td>
                      <td className="mono" style={{ textAlign: "right" }}>{r.value} {def?.unit || ""}</td>
                      <td><Tag tone={r.source === "manual" ? "neutral" : "accent"}>{sourceLabel(r.source)}</Tag></td>
                      <td style={{ textAlign: "right" }}><button className="btn btn-sm btn-ghost" onClick={() => onClearReading(code)}><Icon name="close" size={11}/></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head"><span className="card-title">Sample comment</span></div>
        <div className="card-body">
          <textarea className="ls-input" rows={3}
                    placeholder="Any context worth preserving on the report"
                    value={noteText} onChange={e => setNoteText(e.target.value)} />
        </div>
      </div>
    </>
  );
}

// ============================================================
// Sub-components (file upload, photo slot, manual input)
// ============================================================

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

// Manual reading input — local string draft, commits on Enter/blur.
function ManualReadingInput({ param, onCommit, onClear }) {
  const isText = param.dir === "info" && param.code === "ISO4406";
  const [draft, setDraft] = React.useState("");
  const commit = () => {
    const t = draft.trim();
    if (t === "") { onClear(); return; }
    if (!isText) {
      const n = Number(t);
      if (!isFinite(n)) return;
      onCommit(n);
    } else {
      onCommit(t);
    }
  };
  const onKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); commit(); }
    else if (e.key === "Escape") { setDraft(""); }
  };
  return (
    <div className="ls-param">
      <div className="ls-param-head">
        <span className="mono t-id">{param.code}</span>
        <span className="ls-param-name">{param.name}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input className="ls-input mono"
               type={isText ? "text" : "number"} step="any"
               value={draft}
               onChange={e => setDraft(e.target.value)}
               onKeyDown={onKey}
               onBlur={commit}
               placeholder={limitPlaceholder(param)} />
        <span className="mono t-muted" style={{ fontSize: 11 }}>{param.unit}</span>
      </div>
      <div className="mono ls-param-lim">
        {limitDescription(param)}
        <span style={{ opacity: 0.6 }}> · press <b>Enter</b> to save</span>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function sourceLabel(src) {
  return src === "ir" ? "IR Vision" : src === "flash" ? "Flash Point" : src === "add" ? "Additives" : "Manual";
}

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
  if (p.dir === "min")   return `>= ${p.min}`;
  if (p.dir === "max")   return `<= ${p.max}`;
  if (p.dir === "range") return `${p.min}-${p.max}`;
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
