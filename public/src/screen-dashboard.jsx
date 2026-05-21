// ============================================================
// Dashboard screen — fleet overview, heatmap, alarms, AI insights
// ============================================================
function ScreenDashboard({ siteFilter, section, setRoute, focus, openAI }) {
  const sec = section || "oil";
  const sites = siteFilter === "all" ? window.SITES : window.SITES.filter(s => s.id === siteFilter);
  let assets = siteFilter === "all" ? window.ASSETS : window.ASSETS.filter(a => a.site === siteFilter);
  assets = assets.filter(a => window.getSectionForAsset(a) === sec);
  const assetIds = new Set(assets.map(a => a.id));
  // Show samples that belong to this section (by sample type) and whose
  // engine is in scope of the current site filter.
  const samples = window.SAMPLES.filter(s =>
    window.getSectionForSample(s) === sec &&
    (siteFilter === "all" || assetIds.has(s.assetId))
  );
  const alarms = window.ALARMS.filter(al => assetIds.has(al.assetId));

  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const a of assets) counts[a.code]++;
  const total = assets.length;
  const inQc = samples.filter(s => s.status === "QC").length;
  const pub24 = samples.filter(s => s.status === "PUBLISHED" && (Date.now() - s.receivedAt) < 1000 * 60 * 60 * 48).length;

  // Worst-health asset drives the daily briefing card so it stays
  // truthful even if the underlying dataset changes.
  const worst = assets.slice().sort((a, b) => a.health - b.health)[0];
  const recovered = assets.filter(a => a.health >= 75).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fleet Overview</h1>
          <div className="page-sub">{sites.length} {sites.length === 1 ? "operator" : "operators"} · {total} monitored engines · 28-day window</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={() => window.exportPDF("lab88-fleet-overview.pdf")}><Icon name="download" size={14}/> Export PDF</button>
          <button className="btn btn-primary" onClick={openAI}><Icon name="ai" size={14}/> Ask AI</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label">Total Engines</div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-meta"><span className="delta-flat">stable</span> · {sites.length} operators</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Normal</div>
          <div className="kpi-value" style={{ color: "var(--ok)" }}>{counts[1]}</div>
          <div className="kpi-meta"><span className="delta-dn"><Icon name="arrow-dn" size={11}/>2</span> vs last week · {total ? Math.round(counts[1]/total*100) : 0}%</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Caution</div>
          <div className="kpi-value" style={{ color: "var(--warn)" }}>{counts[2]}</div>
          <div className="kpi-meta"><span className="delta-up"><Icon name="arrow-up" size={11}/>4</span> vs last week</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Critical / Severe</div>
          <div className="kpi-value" style={{ color: "var(--crit)" }}>{counts[3] + counts[4]}</div>
          <div className="kpi-meta"><span className="delta-up"><Icon name="arrow-up" size={11}/>1</span> overdue cam-scope</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">Samples in QC</div>
          <div className="kpi-value">{inQc}</div>
          <div className="kpi-meta">{pub24} published in 48h</div>
        </div>
      </div>

      {/* AI insight banner */}
      <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-line)", background: "linear-gradient(180deg, var(--accent-soft), transparent 60%)" }}>
        <div className="card-body" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: "var(--accent)", color: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <Icon name="ai" size={16}/>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: "0.06em", color: "var(--accent)" }}>CLAUDE · DAILY BRIEFING</span>
              <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>· 06:14 local</span>
            </div>
            <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.55, maxWidth: 880 }}>
              {worst ? (<>
                <b>{worst.name}</b> ({worst.tag}, {worst.siteName}) is your highest-impact follow-up — {sec === "diesel"
                  ? <>flash point and water content are trending toward their SANS 342 limits. Estimated time-to-inspection threshold <b>{worst.rulDays} days</b>. Suggested action: re-sample after the next tank turnover and document the bowser source on the report.</>
                  : <>iron and chromium are running together, consistent with the classic <b>{(worst.classLabel || "engine").toLowerCase()}</b> cam/lifter wear pattern most often tied to low recent utilization. Estimated time-to-inspection threshold <b>{worst.rulDays} hours</b>. Suggested action: cut the oil filter at next change, borescope the cam, and resample at 10h instead of the usual interval.</>}
              </>) : (<>
                Fleet is mostly clean — no engines below 50 score in the current scope. Hold cadence and revisit the daily briefing tomorrow.
              </>)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
              {worst && <button className="btn btn-sm" onClick={() => focus(worst.id)}>Open {worst.name.split(" · ")[0]}</button>}
              <button className="btn btn-sm btn-ghost" onClick={openAI}>Ask follow-up →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap + alarms */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="card-head">
            <span className="card-title">Fleet Heatmap</span>
            <span className="card-sub mono">OPERATORS × ENGINE CLASS · cell = one engine</span>
          </div>
          <div className="card-body no-pad">
            <FleetHeatmap sites={sites} assets={assets} onPick={(a) => focus(a.id)} />
            <div style={{ display: "flex", gap: 12, padding: "10px 16px 14px", borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-3)" }}>
              <span className="mono">LEGEND</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="chip-dot" style={{ background: "var(--ok)" }}/> Normal</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="chip-dot" style={{ background: "var(--warn)" }}/> Caution</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="chip-dot" style={{ background: "var(--crit)" }}/> Critical</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span className="chip-dot" style={{ background: "var(--sev)" }}/> Severe</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Active Alarms</span>
            <button className="btn btn-sm btn-ghost" onClick={() => setRoute("alarms")}>View all <Icon name="chevron-r" size={11}/></button>
          </div>
          <div className="card-body no-pad" style={{ maxHeight: 460, overflow: "auto" }}>
            {alarms.slice(0, 7).map(al => {
              const asset = window.ASSETS.find(a => a.id === al.assetId);
              return (
                <button key={al.id} onClick={() => focus(al.assetId)} style={{
                  display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "flex-start",
                  width: "100%", padding: "12px 16px", borderBottom: "1px solid var(--line)", textAlign: "left",
                  background: al.acknowledged ? "transparent" : "var(--bg-elev)"
                }}>
                  <Chip code={al.code} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{al.assetName} <span className="mono muted">· {al.assetTag}</span></div>
                    <div style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.4 }}>{al.rule}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, fontFamily: "var(--mono)", letterSpacing: 0.04 }}>
                      {al.site.toUpperCase()} · RAISED {window.fmtShortDate(al.raisedAt)} · RUL {al.rulDays}d
                    </div>
                  </div>
                  <Icon name="chevron-r" size={14} style={{ color: "var(--ink-3)", marginTop: 4 }}/>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent samples */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Recent Samples</span>
          <button className="btn btn-sm btn-ghost" onClick={() => setRoute("samples")}>Open Samples <Icon name="chevron-r" size={11}/></button>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr>
              <th>Sample</th><th>Asset</th><th>Site</th><th>Component</th><th>Received</th><th>Score</th><th>Flags</th><th>Analyst</th><th>Status</th>
            </tr></thead>
            <tbody>
              {samples.slice(0, 8).map(s => (
                <tr key={s.id} onClick={() => focus(s.id, "sample")}>
                  <td className="mono t-id">{s.id}</td>
                  <td>{s.assetName} <span className="mono muted">· {s.assetTag}</span></td>
                  <td className="t-muted">{s.siteName}</td>
                  <td>{s.component}</td>
                  <td className="mono t-muted">{window.fmtShortDate(s.receivedAt)}</td>
                  <td><Chip code={s.code}>{s.score}</Chip></td>
                  <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.flags.slice(0, 3).map(f => <Tag key={f}>{f}</Tag>)}</div></td>
                  <td className="t-muted">{s.analyst}</td>
                  <td><span className="status-pill" data-s={s.status}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

window.ScreenDashboard = ScreenDashboard;
