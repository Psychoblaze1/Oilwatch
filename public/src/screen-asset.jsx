// ============================================================
// Asset drill-down — trend chart, components, sample history
// ============================================================
function ScreenAsset({ assetId, back, focus, openAI }) {
  const asset = window.ASSETS.find(a => a.id === assetId) || window.ASSETS[0];
  const [param, setParam] = React.useState("Fe");
  const trend = window.makeTrend(asset, param);
  const samples = window.SAMPLES.filter(s => s.assetId === asset.id).slice(0, 8);

  const params = [
    { id: "Fe",      label: "Iron",        unit: "ppm" },
    { id: "Cr",      label: "Chromium",    unit: "ppm" },
    { id: "Al",      label: "Aluminum",    unit: "ppm" },
    { id: "Visc100", label: "Visc @100°C", unit: "cSt" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <button className="btn btn-sm btn-ghost" onClick={back} style={{ marginBottom: 8 }}>
            <Icon name="chevron-l" size={12}/> Assets
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 className="page-title">{asset.name}</h1>
            <Chip code={asset.code} size="md">{window.COND[asset.code].label.toUpperCase()}</Chip>
            <Tag tone="accent">Criticality {asset.criticality}</Tag>
          </div>
          <div className="page-sub mono" style={{ letterSpacing: 0.06, marginTop: 6 }}>
            {asset.tag} · {asset.classLabel.toUpperCase()} · {asset.siteName.toUpperCase()} · {asset.oem.toUpperCase()} · {asset.runHours.toLocaleString()} RUN HRS
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost"><Icon name="plus" size={14}/> New sample</button>
          <button className="btn btn-ghost" onClick={() => window.exportAssetPDF(asset)}><Icon name="download" size={14}/> Engine report</button>
          <button className="btn btn-primary" onClick={openAI}><Icon name="ai" size={14}/> Ask AI</button>
        </div>
      </div>

      {/* Vitals */}
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div className="kpi">
          <div className="kpi-label">Health Score</div>
          <div className="kpi-value" style={{ color: asset.code === 1 ? "var(--ok)" : asset.code === 2 ? "var(--warn)" : "var(--crit)" }}>{asset.health}</div>
          <div className="kpi-meta">ISO Cond {asset.code} · {window.COND[asset.code].label}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Remaining Useful Life</div>
          <div className="kpi-value">{asset.rulDays}<span style={{ fontSize: 14, color: "var(--ink-3)" }}> d</span></div>
          <div className="kpi-meta" style={{ marginTop: 10 }}><RULBar days={asset.rulDays} total={120}/></div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Last Sample</div>
          <div className="kpi-value" style={{ fontSize: 18, marginTop: 8 }}>{window.fmtDate(asset.lastSample)}</div>
          <div className="kpi-meta">Next due {window.fmtShortDate(asset.nextDue)}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Oil In Service</div>
          <div className="kpi-value" style={{ fontSize: 14, marginTop: 8, fontFamily: "var(--sans)", fontWeight: 500 }}>{asset.oil.name}</div>
          <div className="kpi-meta mono">{asset.oil.iso}</div>
        </div>
      </div>

      {/* Trend */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-head">
          <span className="card-title">Parameter Trend</span>
          <div style={{ display: "flex", gap: 4, marginLeft: 12 }}>
            {params.map(p => (
              <button key={p.id} className={`btn btn-sm ${param === p.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setParam(p.id)}>
                {p.label} <span className="muted" style={{ marginLeft: 4 }}>{p.unit}</span>
              </button>
            ))}
          </div>
          <span className="card-sub mono">12 SAMPLES · ~24 WEEKS</span>
        </div>
        <div className="card-body">
          <TrendChart trend={trend} height={280} />
          <div style={{ display: "flex", gap: 14, marginTop: 12, fontSize: 11, color: "var(--ink-3)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <Icon name="ai" size={11} style={{ color: "var(--accent)" }}/>
              <span><b style={{ color: "var(--ink-2)" }}>Claude:</b> Trend slope +1.8 ppm/sample (3σ above 90-day median). Iron + chromium running together {window.isAviationAsset(asset) ? "is the classic aviation cam/lifter signature" : `is consistent with accelerated wear on this ${(asset.classLabel || "engine").toLowerCase()}`} — recommend cutting the next filter and tightening the sample cadence.</span>
            </span>
          </div>
        </div>
      </div>

      {/* Components + samples */}
      <div className="grid-2">
        <div className="card">
          <div className="card-head"><span className="card-title">Components</span><span className="card-sub mono">{asset.dimensions.length} MONITORED</span></div>
          <div className="card-body no-pad">
            <table className="table">
              <thead><tr><th>Component</th><th>Last reading</th><th>Status</th><th>Trend (90d)</th></tr></thead>
              <tbody>
                {asset.dimensions.map((d, i) => (
                  <tr key={i}>
                    <td>{d.label}</td>
                    <td className="mono">{d.score}</td>
                    <td><Chip code={d.code}>{window.COND[d.code].label}</Chip></td>
                    <td><Sparkline data={Array.from({ length: 8 }, (_, k) => d.score - 6 + k + (k%3)*2)}/></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Sample History</span></div>
          <div className="card-body no-pad">
            <table className="table">
              <thead><tr><th>Sample</th><th>Received</th><th>Score</th><th>Flags</th><th>Status</th></tr></thead>
              <tbody>
                {samples.map(s => (
                  <tr key={s.id} onClick={() => focus(s.id, "sample")}>
                    <td className="mono t-id">{s.id}</td>
                    <td className="mono t-muted">{window.fmtShortDate(s.receivedAt)}</td>
                    <td><Chip code={s.code}>{s.score}</Chip></td>
                    <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.flags.slice(0, 2).map(f => <Tag key={f}>{f}</Tag>)}</div></td>
                    <td><span className="status-pill" data-s={s.status}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenAsset = ScreenAsset;
