// ============================================================
// Sample detail screen — N-dim radar, dimension cards, results, AI rec
// ============================================================
function ScreenSample({ sampleId, back, openAI, role }) {
  const baseSample = window.SAMPLES.find(s => s.id === sampleId) || window.SAMPLES[0];
  const [status, setStatus] = React.useState(baseSample.status);
  React.useEffect(() => { setStatus(baseSample.status); }, [baseSample.id]);
  const sample = { ...baseSample, status };

  const asset = window.ASSETS.find(a => a.id === sample.assetId);
  const results = window.makeTestResults(sample);
  const dims = asset.dimensions;
  const cond = window.COND[sample.code];

  const canApprove = (role === "ANALYST" || role === "MANAGER") && status === "QC";
  const canPublish = (role === "ANALYST" || role === "MANAGER") && status === "APPROVED";

  const updateStatus = (next) => {
    setStatus(next);
    // Mirror into the shared dataset so lifecycle/lists reflect it.
    const idx = window.SAMPLES.findIndex(s => s.id === baseSample.id);
    if (idx >= 0) window.SAMPLES[idx] = { ...window.SAMPLES[idx], status: next };
  };

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
          <button className="btn btn-ghost"><Icon name="barcode" size={14}/> {sample.barcode}</button>
          <button className="btn btn-ghost" onClick={() => window.exportPDF(`oilwatch-${sample.id}.pdf`)}><Icon name="download" size={14}/> Report PDF</button>
          {canApprove && <button className="btn" onClick={() => updateStatus("REJECTED")}>Reject</button>}
          {canApprove && <button className="btn btn-primary" onClick={() => updateStatus("APPROVED")}><Icon name="check" size={14}/> Approve</button>}
          {canPublish && <button className="btn btn-primary" onClick={() => updateStatus("PUBLISHED")}><Icon name="check" size={14}/> Publish</button>}
        </div>
      </div>

      {/* Top: radar + dimension cards + AI */}
      <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Health Assessment</span>
            <Chip code={sample.code} size="md">{cond.label.toUpperCase()}</Chip>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <HealthRadar dimensions={dims} size={260} />
            <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.1 }}>
              ISO COND {sample.code} · {cond.range} BAND
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
              <span className="card-title" style={{ color: "var(--accent)" }}>Claude Recommendation</span>
              <span className="card-sub mono">CONFIDENCE 0.87</span>
            </div>
            <div className="card-body">
              <div style={{ fontSize: 13.5, lineHeight: 1.55, color: "var(--ink)" }}>
                <b>Root cause likely water-accelerated bearing wear.</b> Iron ({results.find(r => r.code === "Fe")?.value} ppm) and copper ({results.find(r => r.code === "Cu")?.value} ppm) co-elevation, paired with water at {results.find(r => r.code === "H2O")?.value} ppm and a {asset.classLabel.toLowerCase().replace(/s$/, "")}-typical viscosity drop, matches a pattern observed in <b>3 historical failures</b> on this site. Estimated remaining useful life <b>{asset.rulDays} days</b> at current trend slope.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>SUGGESTED ACTION</div>
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>Re-sample within 72h</div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>INSPECT</div>
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>Coupling alignment</div>
                </div>
                <div style={{ padding: "10px 12px", background: "var(--bg-sunken)", borderRadius: 6 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--ink-3)", letterSpacing: 0.08 }}>RUL ESTIMATE</div>
                  <RULBar days={asset.rulDays} total={120} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button className="btn btn-sm" onClick={openAI}>Ask follow-up</button>
                <button className="btn btn-sm btn-ghost">Cite 3 similar cases</button>
                <button className="btn btn-sm btn-ghost">Override / flag</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Test Results</span>
          <span className="card-sub mono">{results.length} PARAMETERS · BASELINE: {asset.oil.name.toUpperCase()}</span>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr>
              <th>Parameter</th><th>Value</th><th>Unit</th><th>Warn</th><th>Alarm</th><th>Status</th><th>Method</th><th></th>
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
                  <td><Sparkline data={[r.value*0.6, r.value*0.65, r.value*0.7, r.value*0.78, r.value*0.85, r.value*0.92, typeof r.value === "number" ? r.value : 18].map(v => typeof v === "number" ? v : 18)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
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
            <div className="muted">Method panel</div><div>OIL-STD-22 (Industrial)</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">Equipment Context</span></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "8px 14px", fontSize: 12.5 }}>
            <div className="muted">OEM</div><div>{asset.oem}</div>
            <div className="muted">Class</div><div>{asset.classLabel}</div>
            <div className="muted">Criticality</div><div><Tag tone="accent">Class {asset.criticality}</Tag></div>
            <div className="muted">Run hours</div><div className="mono">{asset.runHours.toLocaleString()} h</div>
            <div className="muted">Oil</div><div>{asset.oil.brand} · {asset.oil.name}</div>
            <div className="muted">ISO grade</div><div className="mono">{asset.oil.iso}</div>
          </div>
        </div>
        <div className="card">
          <div className="card-head"><span className="card-title">Workflow</span></div>
          <div className="card-body" style={{ fontSize: 12.5 }}>
            {[
              { s: "Collected",  t: "Apr 28 · 09:14",  who: "T. Reyes (TECH)" },
              { s: "Received",   t: "Apr 29 · 13:02",  who: "Lab intake" },
              { s: "Tested",     t: "Apr 30 · 08:47",  who: "Spec lab" },
              { s: "QC review",  t: "May 01 · 14:18",  who: sample.analyst + " (ANALYST)" },
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
    </div>
  );
}

window.ScreenSample = ScreenSample;
