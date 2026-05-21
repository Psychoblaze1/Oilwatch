// ============================================================
// Sample detail screen — N-dim radar, dimension cards, results, AI rec
// ============================================================
function ScreenSample({ sampleId, back, openAI, role, refresh }) {
  const baseSample = window.SAMPLES.find(s => s.id === sampleId) || window.SAMPLES[0];
  if (!baseSample) {
    return <div className="page"><div className="page-sub">Sample not found.</div></div>;
  }
  const [status, setStatus] = React.useState(baseSample.status);
  React.useEffect(() => { setStatus(baseSample.status); }, [baseSample.id]);
  const sample = { ...baseSample, status };

  const asset = window.ASSETS.find(a => a.id === sample.assetId) || {};
  const isDiesel = window.isDieselSample(sample);
  const results = isDiesel
    ? window.resolveDieselResults(sample.results || [])
    : (sample.results ? window.resolveResults(sample.results, asset.class) : window.makeTestResults(sample));
  const dims = asset.dimensions || [];
  const cond = window.COND[sample.code] || window.COND[1];

  const canApprove = (role === "ANALYST" || role === "MANAGER") && status === "QC";
  const canPublish = (role === "ANALYST" || role === "MANAGER") && status === "APPROVED";
  const canReopen  = (role === "ANALYST" || role === "MANAGER" || role === "ADMIN") && status === "REJECTED";
  const canReeval  = (role === "ANALYST" || role === "MANAGER") && status !== "DRAFT";

  const updateStatus = async (next) => {
    setStatus(next);
    const idx = window.SAMPLES.findIndex(s => s.id === baseSample.id);
    if (idx >= 0) window.SAMPLES[idx] = { ...window.SAMPLES[idx], status: next };
    try { await window.api.setSampleStatus(baseSample.id, next); }
    catch (e) { console.error("setSampleStatus failed", e); }
    refresh && refresh();
  };
  const reevaluate = async () => {
    try {
      const r = await window.api.reevaluateSample(baseSample.id);
      const idx = window.SAMPLES.findIndex(s => s.id === baseSample.id);
      if (idx >= 0 && r) window.SAMPLES[idx] = { ...window.SAMPLES[idx], score: r.score, code: r.code, flags: r.flags || [] };
      refresh && refresh();
    } catch (e) { alert("Re-evaluate failed: " + e.message); }
  };

  // Render the diesel sample view (SANS 342:2016 panel) instead of the
  // aviation oil layout when the sample type calls for it.
  if (isDiesel) {
    return (
      <DieselSampleView
        sample={sample}
        asset={asset}
        results={results}
        status={status}
        canApprove={canApprove}
        canPublish={canPublish}
        updateStatus={updateStatus}
        reevaluate={reevaluate}
        canReopen={canReopen}
        canReeval={canReeval}
        back={back}
        openAI={openAI}
        refresh={refresh}
        role={role}
      />
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-sm btn-ghost" onClick={back} style={{ marginBottom: 8 }}>
            <Icon name="chevron-l" size={12}/> Samples
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">{sample.id}</h1>
            <span className="status-pill" data-s={sample.status}>{sample.status}</span>
            {sample.priority === "RUSH" && <Tag tone="accent">RUSH</Tag>}
          </div>
          <div className="page-sub mono" style={{ letterSpacing: 0.06, marginTop: 6 }}>
            {sample.assetName.toUpperCase()} · {sample.assetTag} · {sample.component.toUpperCase()} · {sample.siteName.toUpperCase()} · RECEIVED {window.fmtDate(sample.receivedAt).toUpperCase()}
          </div>
        </div>
        <div className="page-actions">
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.05em", marginRight: 4 }}>
            <Icon name="barcode" size={12} style={{ verticalAlign: "middle", marginRight: 4 }}/>{sample.barcode}
          </span>
          <button className="btn btn-primary" onClick={() => window.exportSamplePDF(sample)}>
            <Icon name="download" size={14}/> Print Report
          </button>
        </div>
      </div>

      {/* Top: radar + dimension cards + AI */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Health Vector</span>
            <Chip code={sample.code} size="md">{cond.label.toUpperCase()}</Chip>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <HealthRadar dimensions={dims} size={210} />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.1 }}>
              SCORE {sample.score} · COND {sample.code} ({cond.range})
            </div>
            <div className="mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: 0.08, marginTop: 4 }}>
              ON-SCREEN ONLY · NOT IN PRINT REPORT
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 16 }}>
          {/* Dimension cards */}
          <div className="card">
            <div className="card-head">
              <span className="card-title">Health Dimensions</span>
              <span className="card-sub mono">N = {dims.length} · {asset.classLabel.toUpperCase()}</span>
            </div>
            <div className="card-body no-pad" style={{ display: "grid", gridTemplateColumns: `repeat(${dims.length}, 1fr)` }}>
              {dims.map((d, i) => (
                <div key={i} style={{ padding: "14px 16px", borderRight: i < dims.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div className="mono" style={{ fontSize: 10, letterSpacing: 0.12, color: "var(--ink-3)", textTransform: "uppercase" }}>{d.label}</div>
                  <div className="mono" style={{ fontSize: 26, fontWeight: 600, marginTop: 4, color: "var(--ink)" }}>{d.score}</div>
                  <div style={{ marginTop: 6 }}><Chip code={d.code} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* AI rec */}
          <div className="card" style={{ borderColor: "var(--accent-line)" }}>
            <div className="card-head" style={{ borderBottom: "1px solid var(--accent-line)" }}>
              <Icon name="ai" size={14} style={{ color: "var(--accent)" }}/>
              <span className="card-title" style={{ color: "var(--accent)" }}>Diagnostic Summary</span>
              <span className="card-sub mono">CLAUDE · CONFIDENCE 0.87</span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)" }}>
                {window.isAviationAsset(asset) ? (
                  <><b>Likely cam / lifter wear.</b> Iron ({results.find(r => r.code === "Fe")?.value} ppm) and chromium ({results.find(r => r.code === "Cr")?.value} ppm) are running together — the classic aviation corrosion-driven cam pattern, often tied to low recent activity. Aluminum at {results.find(r => r.code === "Al")?.value} ppm and silicon at {results.find(r => r.code === "Si")?.value} ppm round out the picture. Matches <b>3 historical patterns</b> on this engine class. Recommend a filter cut at the next change and a follow-up at 10 hours rather than the usual interval. Estimated time to inspection threshold: <b>{asset.rulDays} hours</b>.</>
                ) : (
                  <><b>Elevated wear-metal signature.</b> Iron ({results.find(r => r.code === "Fe")?.value} ppm) and chromium ({results.find(r => r.code === "Cr")?.value} ppm) are running together on this <b>{(asset.classLabel || "engine").toLowerCase()}</b> — consistent with accelerated frictional wear under the current duty cycle. Aluminum at {results.find(r => r.code === "Al")?.value} ppm and silicon at {results.find(r => r.code === "Si")?.value} ppm round out the picture. Recommend a filter cut at the next change and shorten the sample cadence for the next two intervals. Estimated time to inspection threshold: <b>{asset.rulDays} hours</b>.</>
                )}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>SUGGESTED ACTION</div>
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>Cut oil filter · resample 10h</div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>INSPECT</div>
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>{window.isAviationAsset(asset) ? "Borescope cam & lifters" : "Inspect bearings & cylinder liner"}</div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>EST. TIL ACTION</div>
                  <RULBar days={asset.rulDays} total={120} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm" onClick={openAI}>Ask follow-up</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Test Results</span>
          <span className="card-sub mono">{results.length} PARAMETERS · BASELINE: {(asset.oil?.name || "—").toUpperCase()}</span>
        </div>
        <div className="card-body no-pad">
          {results.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              No results yet — sample is in DRAFT. Use <b>Log sample</b> to attach instrument readings.
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>Parameter</th><th>Value</th><th>Unit</th><th>Warn</th><th>Alarm</th><th>Status</th><th>Method</th>
              </tr></thead>
              <tbody>
                {results.map(r => (
                  <tr key={r.code}>
                    <td><span className="mono t-id" style={{ marginRight: 8 }}>{r.code}</span>{r.name}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{typeof r.value === "number" ? (Number.isInteger(r.value) ? r.value : r.value.toFixed(1)) : r.value}</td>
                    <td className="mono t-muted">{r.unit}</td>
                    <td className="mono t-muted">{r.warn}</td>
                    <td className="mono t-muted">{r.alarm}</td>
                    <td>
                      {r.status === "alarm" && <Chip code={3}>ALARM</Chip>}
                      {r.status === "warn"  && <Chip code={2}>WARN</Chip>}
                      {r.status === "ok"    && <Chip code={1}>OK</Chip>}
                    </td>
                    <td className="mono t-muted">{r.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Meta */}
      <div className="grid-3">
        <div className="card">
          <div className="card-head"><span className="card-title">Sample Meta</span></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 12.5 }}>
            <div className="muted">Barcode</div><div className="mono">{sample.barcode}</div>
            <div className="muted">Asset</div><div>{sample.assetName} · {sample.assetTag}</div>
            <div className="muted">Component</div><div>{sample.component}</div>
            <div className="muted">Site</div><div>{sample.siteName}</div>
            <div className="muted">Received</div><div className="mono">{window.fmtDate(sample.receivedAt)}</div>
            <div className="muted">Analyst</div><div>{sample.analyst}</div>
            <div className="muted">Method panel</div><div>AVI-STD-12 (Piston Aircraft)</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">Equipment Context</span></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 12.5 }}>
            <div className="muted">OEM</div><div>{asset.oem}</div>
            <div className="muted">Class</div><div>{asset.classLabel}</div>
            {sample.locationName && <><div className="muted">Location</div><div>{sample.locationName}</div></>}
            {sample.assetTypeName && <><div className="muted">Asset Type</div><div>{sample.assetTypeName}</div></>}
            <div className="muted">Criticality</div><div><Tag tone="accent">Class {asset.criticality}</Tag></div>
            <div className="muted">Engine hours (TSMOH)</div><div className="mono">{asset.runHours.toLocaleString()} h</div>
            <div className="muted">Oil</div><div>{asset.oil.brand} · {asset.oil.name}</div>
            <div className="muted">SAE grade</div><div className="mono">{asset.oil.iso}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">Workflow</span></div>
          <div className="card-body" style={{ fontSize: 12.5 }}>
            {[
              { s: "Drawn at oil change", t: "Apr 28 · 09:14",  who: "T. Reyes (A&P)" },
              { s: "Mail-in received",    t: "Apr 29 · 13:02",  who: "Lab intake" },
              { s: "ICP-OES + GC + Karl Fischer", t: "Apr 30 · 08:47",  who: "Spec lab" },
              { s: "QC review",           t: "May 01 · 14:18",  who: sample.analyst + " (ANALYST)" },
            ].map((step, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "14px 1fr", gap: 10, padding: "6px 0", borderBottom: i < 3 ? "1px solid var(--line)" : "none" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", marginTop: 6 }}/>
                <div>
                  <div style={{ fontSize: 12.5 }}>{step.s}</div>
                  <div className="mono muted" style={{ fontSize: 10.5, letterSpacing: 0.05 }}>{step.t.toUpperCase()} · {step.who.toUpperCase()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <FieldReferencesCard assetId={sample.assetId} />

      {/* Internal workflow actions — kept off the printed report. */}
      <div className="card" style={{ marginTop: 16, borderColor: "var(--accent-line)" }}>
        <div className="card-head">
          <span className="card-title">Internal Workflow Actions</span>
          <span className="card-sub mono">NOT INCLUDED IN PRINTED REPORT</span>
        </div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1, minWidth: 320 }}>
            Current status: <span className="status-pill" data-s={status}>{status}</span>.
            {canApprove && " Approve to move into the publish queue, or reject to remove it from the lifecycle."}
            {canPublish && " Publish makes this report visible to the operator."}
            {!canApprove && !canPublish && " No workflow actions available at this status / role."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canReeval && <button className="btn btn-ghost" onClick={reevaluate} title="Re-grade this sample against the current limits"><Icon name="ai" size={12}/> Re-evaluate</button>}
            {canReopen && <button className="btn" onClick={() => updateStatus("QC")}>Reopen to QC</button>}
            {canApprove && <button className="btn" onClick={() => updateStatus("REJECTED")}>Reject</button>}
            {canApprove && <button className="btn btn-primary" onClick={() => updateStatus("APPROVED")}><Icon name="check" size={14}/> Approve</button>}
            {canPublish && <button className="btn btn-primary" onClick={() => updateStatus("PUBLISHED")}><Icon name="check" size={14}/> Publish to operator</button>}
          </div>
        </div>
      </div>

      <SampleNotesCard sample={sample} role={role} refresh={refresh} />
    </div>
  );
}

window.ScreenSample = ScreenSample;

// ============================================================
// Diesel sample view (SANS 342:2016 layout)
// ============================================================
function DieselSampleView({ sample, asset, results, status, canApprove, canPublish, canReopen, canReeval, updateStatus, reevaluate, back, openAI, refresh, role }) {
  const site = window.SITES.find(s => s.id === asset?.site) || {};
  const sampleType = window.getSampleType(sample);
  const standard = sampleType.standard || "SANS 342:2016";
  const verdict = window.dieselVerdict(results) || (results.length === 0 ? null : "PASS");

  const critical = results.filter(r => r.group === "critical");
  const particle = results.filter(r => r.group === "particle");
  const elemental = results.filter(r => r.group === "elemental");
  const ir = results.filter(r => r.group === "ir");
  const distillation = results.filter(r => r.group === "distillation");

  const onFile = async (file) => {
    if (!file) return;
    const dataUrl = await downsizeImage(file, 800, 0.82);
    const idx = window.SAMPLES.findIndex(s => s.id === sample.id);
    if (idx >= 0) window.SAMPLES[idx] = { ...window.SAMPLES[idx], filterPatch: dataUrl };
    try { await window.api.attachFilterPatch(sample.id, dataUrl); }
    catch (e) { console.error("filter patch upload failed", e); }
    refresh && refresh();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-sm btn-ghost" onClick={back} style={{ marginBottom: 8 }}>
            <Icon name="chevron-l" size={12}/> Samples
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 className="page-title">{sample.id}</h1>
            <Tag tone="accent">DIESEL</Tag>
            <span className="status-pill" data-s={status}>{status}</span>
            {sample.priority === "RUSH" && <Tag tone="accent">RUSH</Tag>}
          </div>
          <div className="page-sub mono" style={{ letterSpacing: 0.06, marginTop: 6 }}>
            {(site.name || sample.siteName || "—").toUpperCase()} · {(sample.component || "—").toUpperCase()} · {sampleType.label.toUpperCase()} · RECEIVED {window.fmtDate(sample.receivedAt).toUpperCase()}
          </div>
        </div>
        <div className="page-actions">
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", letterSpacing: "0.05em", marginRight: 4 }}>
            <Icon name="barcode" size={12} style={{ verticalAlign: "middle", marginRight: 4 }}/>{sample.barcode}
          </span>
          <button className="btn btn-primary" onClick={() => window.exportSamplePDF(sample)}>
            <Icon name="download" size={14}/> Print Report
          </button>
        </div>
      </div>

      {/* Sample Information grid — mirrors the SANS report layout */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head"><span className="card-title">Sample Information</span></div>
        <div className="card-body no-pad">
          <div className="dsl-info">
            <DslInfoCell label="Company name" value={site.name || sample.siteName} />
            <DslInfoCell label="Location"     value={sample.locationName || site.region || "—"} />
            <DslInfoCell label="Asset Type"   value={sample.assetTypeName || asset?.classLabel || "—"} />
            <DslInfoCell label="Equipment"    value={asset?.name || "None"} />
            <DslInfoCell label="Sample Date"  value={window.fmtDate(sample.receivedAt)} />
            <DslInfoCell label="Diesel Type"  value={sampleType.label.replace(/^Diesel\s*[—-]\s*/, "")} />
            <DslInfoCell label="Sample"       value={sample.id} />
            <DslInfoCell label="Note"         value={sample.note || "None"} />
          </div>
        </div>
      </div>

      {/* Verdict pill */}
      {verdict && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, margin: "16px 0 22px" }}>
          <span className={`dsl-verdict ${verdict === "PASS" ? "ok" : "fail"}`}>{verdict}</span>
          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
            This sample {verdict === "PASS" ? "conforms to" : "does not conform to"} <b>{standard}</b> standards.
          </div>
        </div>
      )}

      {/* Critical Properties */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Critical Properties</span>
          <span className="card-sub mono">{critical.length} TESTS · {standard.toUpperCase()}</span>
        </div>
        <div className="card-body no-pad">
          {critical.length === 0 ? (
            <div style={{ padding: 28, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              No critical-property readings yet — sample is in DRAFT.
            </div>
          ) : (
            <table className="table">
              <thead><tr>
                <th>Test</th><th>Result</th><th>Limit</th><th>Status</th><th>Method</th>
              </tr></thead>
              <tbody>
                {critical.map(r => (
                  <tr key={r.code}>
                    <td>{r.name}</td>
                    <td className="mono" style={{ fontWeight: 600 }}>{fmtNumOrStr(r.value)}{r.unit ? " " + r.unit : ""}</td>
                    <td className="mono t-muted">{dieselLimitLabel(r)}</td>
                    <td><span className={`dsl-bar ${r.status === "pass" ? "ok" : r.status === "fail" ? "fail" : ""}`}>{(r.status || "—").toUpperCase()}</span></td>
                    <td className="mono t-muted">{r.method}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Particle / Elemental side-by-side */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <DslSimpleTable title="Particle Count — ISO 4406" leftLabel="Test" rightLabel="Result"
          rows={particle.map(r => ({ label: r.name, value: fmtNumOrStr(r.value) }))} />
        <DslSimpleTable title="Elemental — ASTM D4294" leftLabel="Additive" rightLabel="Concentration"
          rows={elemental.map(r => ({ label: r.name, value: r.value != null ? `${fmtNumOrStr(r.value)} ppm` : "—" }))} />
      </div>

      {/* IR Vision / Distillation / Filter Patch row */}
      <div className="grid-3" style={{ marginBottom: 16 }}>
        <DslSimpleTable title="IR Vision Data" leftLabel="Parameter" rightLabel="Value"
          rows={ir.map(r => ({ label: r.name, value: r.value != null ? `${fmtNumOrStr(r.value)}${r.unit ? " " + r.unit : ""}` : "—" }))} />

        <div className="card">
          <div className="card-head"><span className="card-title">Distillation Curve</span></div>
          <div className="card-body" style={{ padding: 12 }}>
            <DistillationChartSVG points={distillation} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Filter Patch — IP440</span>
            <label className="btn btn-sm btn-ghost" style={{ marginLeft: "auto", cursor: "pointer" }}>
              <Icon name="plus" size={12}/> {sample.filterPatch ? "Replace" : "Upload"}
              <input type="file" accept="image/*" style={{ display: "none" }}
                     onChange={e => onFile(e.target.files?.[0])}/>
            </label>
          </div>
          <div className="card-body" style={{ padding: 12, display: "grid", placeItems: "center" }}>
            {sample.filterPatch
              ? <img src={sample.filterPatch} alt="Filter patch" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6 }} />
              : <div style={{ width: "100%", aspectRatio: "1 / 1", maxHeight: 200,
                              display: "grid", placeItems: "center", background: "var(--bg-sunken)",
                              border: "1px dashed var(--line)", borderRadius: 6,
                              color: "var(--ink-3)", fontSize: 12 }}>
                  No filter-patch photo on file
                </div>}
          </div>
        </div>
      </div>

      <FieldReferencesCard assetId={sample.assetId} />

      {/* Internal workflow actions — kept off the printed report. */}
      <div className="card" style={{ marginTop: 16, borderColor: "var(--accent-line)" }}>
        <div className="card-head">
          <span className="card-title">Internal Workflow Actions</span>
          <span className="card-sub mono">NOT INCLUDED IN PRINTED REPORT</span>
        </div>
        <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1, minWidth: 320 }}>
            Current status: <span className="status-pill" data-s={status}>{status}</span>.
            {canApprove && " Approve to move into the publish queue, or reject to remove it from the lifecycle."}
            {canPublish && " Publish makes this report visible to the operator."}
            {!canApprove && !canPublish && " No workflow actions available at this status / role."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canReeval && <button className="btn btn-ghost" onClick={reevaluate} title="Re-grade this sample against the current limits"><Icon name="ai" size={12}/> Re-evaluate</button>}
            {canReopen && <button className="btn" onClick={() => updateStatus("QC")}>Reopen to QC</button>}
            {canApprove && <button className="btn" onClick={() => updateStatus("REJECTED")}>Reject</button>}
            {canApprove && <button className="btn btn-primary" onClick={() => updateStatus("APPROVED")}><Icon name="check" size={14}/> Approve</button>}
            {canPublish && <button className="btn btn-primary" onClick={() => updateStatus("PUBLISHED")}><Icon name="check" size={14}/> Publish to operator</button>}
          </div>
        </div>
      </div>

      <SampleNotesCard sample={sample} role={role} refresh={refresh} />

      <style>{`
        .dsl-info { display: grid; grid-template-columns: repeat(4, 1fr); }
        .dsl-info > div { padding: 10px 14px; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); }
        .dsl-info > div:nth-child(4n) { border-right: 0; }
        .dsl-info > div:nth-last-child(-n+4) { border-bottom: 0; }
        .dsl-info-lbl { font-size: 10px; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; font-family: var(--mono); }
        .dsl-info-val { font-size: 13px; color: var(--ink); margin-top: 4px; word-break: break-word; }
        .dsl-verdict {
          display: inline-block; padding: 8px 26px;
          border-radius: 999px; font-weight: 700; font-size: 16px;
          letter-spacing: 0.06em; color: #fff;
        }
        .dsl-verdict.ok { background: var(--ok); }
        .dsl-verdict.fail { background: var(--crit); }
        .dsl-bar {
          display: inline-block; min-width: 64px; padding: 4px 10px; border-radius: 4px;
          font-family: var(--mono); font-size: 11px; font-weight: 600;
          color: #fff; text-align: center; background: var(--ink-4);
        }
        .dsl-bar.ok   { background: var(--ok); }
        .dsl-bar.fail { background: var(--crit); }
      `}</style>
    </div>
  );
}

function DslInfoCell({ label, value }) {
  return (
    <div>
      <div className="dsl-info-lbl">{label}</div>
      <div className="dsl-info-val">{value || "—"}</div>
    </div>
  );
}

function DslSimpleTable({ title, leftLabel, rightLabel, rows }) {
  return (
    <div className="card">
      <div className="card-head"><span className="card-title">{title}</span></div>
      <div className="card-body no-pad">
        {rows.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 12.5 }}>—</div>
        ) : (
          <table className="table">
            <thead><tr><th>{leftLabel}</th><th style={{ textAlign: "right" }}>{rightLabel}</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td>{r.label}</td>
                  <td className="mono" style={{ textAlign: "right" }}>{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function DistillationChartSVG({ points }) {
  const W = 280, H = 180, padL = 32, padR = 6, padT = 8, padB = 24;
  const filled = (points || []).filter(p => p.value != null && !isNaN(Number(p.value)));
  if (filled.length < 2) {
    return <div style={{ height: H, display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12 }}>
      Not enough points to plot.
    </div>;
  }
  const vmin = Math.min(...filled.map(p => Number(p.value)));
  const vmax = Math.max(...filled.map(p => Number(p.value)));
  const pad  = (vmax - vmin) * 0.1 || 10;
  const lo = Math.floor((vmin - pad) / 10) * 10;
  const hi = Math.ceil((vmax + pad) / 10) * 10;
  const xAt = i => padL + (W - padL - padR) * (i / (filled.length - 1));
  const yAt = v => padT + (H - padT - padB) * (1 - (v - lo) / (hi - lo));
  const path = filled.map((p, i) => (i === 0 ? "M" : "L") + xAt(i).toFixed(1) + " " + yAt(Number(p.value)).toFixed(1)).join(" ");
  const labelMap = { Dist_IBP: "IBP", Dist_T10: "T10", Dist_T50: "T50", Dist_T65: "T65", Dist_T85: "T85", Dist_T95: "T95", Dist_FBP: "FBP" };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padT + t * (H - padT - padB);
        const v = hi - t * (hi - lo);
        return (<g key={t}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="0.4" />
          <text x={padL - 4} y={y + 3} textAnchor="end" style={{ fontSize: 9, fill: "var(--ink-3)", fontFamily: "var(--mono)" }}>{Math.round(v)}</text>
        </g>);
      })}
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="1.8" />
      {filled.map((p, i) => (
        <circle key={i} cx={xAt(i)} cy={yAt(Number(p.value))} r="3" fill="var(--accent)" />
      ))}
      {filled.map((p, i) => (
        <text key={"x"+i} x={xAt(i)} y={H - padB + 14} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-3)", fontFamily: "var(--mono)" }}>
          {labelMap[p.code] || p.label || p.code}
        </text>
      ))}
    </svg>
  );
}

// ---- Small helpers used by the diesel view -------------------------

function fmtNumOrStr(v) {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2);
  return String(v);
}

function dieselLimitLabel(p) {
  if (!p) return "—";
  if (p.dir === "min")   return `≥ ${p.min} ${p.unit} min`.trim();
  if (p.dir === "max")   return `≤ ${p.max} ${p.unit} max`.trim();
  if (p.dir === "range") return `${p.min} – ${p.max} ${p.unit}`.trim();
  return "—";
}

// Client-side resize that the filter-patch upload uses to keep
// payloads reasonable. Returns a JPEG data URL.
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

window.DieselSampleView = DieselSampleView;

// ============================================================
// Field references — every web citation the AI has surfaced for the
// engine this sample belongs to. Pulled from /api/ai/library.
// ============================================================
// Append-only analyst notes timeline. Notes are stored as a JSON array
// on the sample (`notes` field) so existing approvals can still get
// commentary attached without rewriting the workflow log.
function SampleNotesCard({ sample, role, refresh }) {
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const canAdd = role === "TECH" || role === "ANALYST" || role === "MANAGER" || role === "ADMIN";
  // Accept either the structured array (new) or a single legacy string.
  const notes = (() => {
    if (Array.isArray(sample.notes) && sample.notes.length) return sample.notes;
    if (sample.note) return [{ id: 0, author: sample.analyst || "—", role: "ANALYST", text: sample.note, at: sample.receivedAt }];
    return [];
  })();
  const add = async () => {
    const t = text.trim();
    if (!t) return;
    setSaving(true);
    try {
      const r = await window.api.addSampleNote(sample.id, {
        text: t,
        author: (window.CURRENT_USER && window.CURRENT_USER.name) || "Operator",
        role: role || "ANALYST",
      });
      const idx = window.SAMPLES.findIndex(s => s.id === sample.id);
      if (idx >= 0 && r) window.SAMPLES[idx] = { ...window.SAMPLES[idx], notes: r.notes };
      setText("");
      refresh && refresh();
    } catch (e) { alert("Save failed: " + e.message); }
    finally { setSaving(false); }
  };
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <span className="card-title">Analyst Notes</span>
        <span className="card-sub mono">{notes.length} ENTR{notes.length === 1 ? "Y" : "IES"} · APPEND-ONLY</span>
      </div>
      <div className="card-body no-pad">
        {notes.length === 0 ? (
          <div style={{ padding: 16, color: "var(--ink-3)", fontSize: 12.5 }}>
            No analyst notes on this sample yet.
          </div>
        ) : notes.map((n, i) => (
          <div key={n.id ?? i} style={{ padding: "10px 14px", borderBottom: i < notes.length - 1 ? "1px solid var(--line)" : "none" }}>
            <div style={{ fontSize: 13, color: "var(--ink)", whiteSpace: "pre-wrap" }}>{n.text}</div>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, letterSpacing: 0.05 }}>
              {(n.author || "—").toUpperCase()}{n.role ? " · " + n.role : ""} · {window.fmtDate(n.at)}
            </div>
          </div>
        ))}
      </div>
      {canAdd && (
        <div className="card-body" style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <textarea rows={2} value={text} onChange={e => setText(e.target.value)}
            placeholder="Add a note — visible to other analysts and printed on the report."
            style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid var(--line)", background: "var(--bg-sunken)", color: "var(--ink)", fontFamily: "var(--sans)", fontSize: 13, resize: "vertical" }} />
          <button className="btn btn-primary" disabled={!text.trim() || saving} onClick={add}>
            <Icon name="plus" size={12}/> Add note
          </button>
        </div>
      )}
    </div>
  );
}

function FieldReferencesCard({ assetId }) {
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  React.useEffect(() => {
    if (!assetId) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await window.api.aiLibrary({ assetId, limit: 25 });
        if (!cancelled) setItems(r.responses || []);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [assetId]);
  if (loading || !assetId) return null;
  const citations = [];
  for (const r of items) for (const c of (r.citations || [])) citations.push({ ...c, question: r.userQuestion });
  if (citations.length === 0) return null;
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="card-head">
        <span className="card-title">Field references</span>
        <span className="card-sub mono">{citations.length} CITATION{citations.length === 1 ? "" : "S"} · FROM AI WEB SEARCHES ON THIS ENGINE</span>
      </div>
      <div className="card-body no-pad">
        {citations.slice(0, 12).map((c, k) => (
          <a key={k} href={c.url} target="_blank" rel="noopener" style={{
            display: "block", padding: "10px 14px",
            borderBottom: k < Math.min(citations.length, 12) - 1 ? "1px solid var(--line)" : "none",
            color: "var(--ink)", textDecoration: "none",
          }}>
            <span className="mono" style={{ fontSize: 11, color: "var(--accent)" }}>{c.domain || "link"}</span>
            <span style={{ marginLeft: 8, fontSize: 12.5 }}>{c.title || c.url}</span>
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3 }}>{c.question}</div>
          </a>
        ))}
      </div>
    </div>
  );
}
