// ============================================================
// Sample Lifecycle — kanban DRAFT → QC → APPROVED → PUBLISHED
// ============================================================
function ScreenLifecycle({ siteFilter, focus, role }) {
  const columns = [
    { id: "DRAFT",     label: "Draft",     hint: "Collection in progress" },
    { id: "QC",        label: "In QC",     hint: "Awaiting analyst review" },
    { id: "APPROVED",  label: "Approved",  hint: "Signed off · pending publish" },
    { id: "PUBLISHED", label: "Published", hint: "Distributed to customer" },
  ];
  const assets = siteFilter === "all" ? window.ASSETS : window.ASSETS.filter(a => a.site === siteFilter);

  // Local mirror of statuses so the kanban can advance cards without
  // needing a server round-trip in this prototype.
  const [overrides, setOverrides] = React.useState({});
  const statusOf = (s) => overrides[s.id] || s.status;

  const filtered = window.SAMPLES.filter(s => assets.find(a => a.id === s.assetId));
  const byStatus = Object.fromEntries(columns.map(c => [c.id, filtered.filter(s => statusOf(s) === c.id)]));
  const rejected = filtered.filter(s => statusOf(s) === "REJECTED");

  const setStatus = (id, next) => {
    setOverrides(o => ({ ...o, [id]: next }));
    const idx = window.SAMPLES.findIndex(s => s.id === id);
    if (idx >= 0) window.SAMPLES[idx] = { ...window.SAMPLES[idx], status: next };
  };
  const bulkApprove = () => {
    const qcIds = byStatus.QC.map(s => s.id);
    qcIds.forEach(id => setStatus(id, "APPROVED"));
  };
  const next = { DRAFT: "QC", QC: "APPROVED", APPROVED: "PUBLISHED" };
  const canAdvance = (s) => {
    const cur = statusOf(s);
    if (cur === "DRAFT" && (role === "TECH" || role === "ANALYST" || role === "MANAGER")) return "QC";
    if (cur === "QC" && (role === "ANALYST" || role === "MANAGER")) return "APPROVED";
    if (cur === "APPROVED" && (role === "ANALYST" || role === "MANAGER")) return "PUBLISHED";
    return null;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sample Lifecycle</h1>
          <div className="page-sub">{filtered.length} active samples · {rejected.length} rejected in window</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> Priority</button>
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> Analyst</button>
          {role === "TECH" && <button className="btn btn-primary"><Icon name="plus" size={14}/> Log collection</button>}
          {role === "ANALYST" && <button className="btn btn-primary" onClick={bulkApprove}><Icon name="check" size={14}/> Bulk approve QC</button>}
        </div>
      </div>

      {/* Pipeline counters */}
      <div className="kpi-row" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {columns.map(c => (
          <div key={c.id} className="kpi">
            <div className="kpi-label">{c.label}</div>
            <div className="kpi-value">{byStatus[c.id].length}</div>
            <div className="kpi-meta">{c.hint}</div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        {columns.map(col => (
          <div key={col.id} style={{ background: "var(--bg-sunken)", borderRadius: 10, border: "1px solid var(--line)", display: "flex", flexDirection: "column", maxHeight: 720 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
              <span className="status-pill" data-s={col.id}>{col.id}</span>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)", marginLeft: "auto" }}>{byStatus[col.id].length}</span>
            </div>
            <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 8, overflow: "auto", flex: 1 }}>
              {byStatus[col.id].slice(0, 12).map(s => {
                const advance = canAdvance(s);
                return (
                  <div key={s.id} style={{
                    background: "var(--bg-elev)", border: "1px solid var(--line)", borderRadius: 8,
                    padding: "10px 12px"
                  }}>
                    <button onClick={() => focus(s.id, "sample")} style={{ display: "block", width: "100%", textAlign: "left", cursor: "pointer" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <span className="mono t-id" style={{ fontSize: 11 }}>{s.id}</span>
                        <Chip code={s.code} size="sm">{s.score}</Chip>
                      </div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{s.assetName}</div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.04 }}>
                        {s.assetTag} · {s.component.toUpperCase()}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                        <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                          {s.flags.slice(0, 3).map(f => <Tag key={f}>{f}</Tag>)}
                          {s.priority === "RUSH" && <Tag tone="accent">RUSH</Tag>}
                        </div>
                        <span className="mono" style={{ fontSize: 10, color: "var(--ink-3)" }}>{window.fmtShortDate(s.receivedAt)}</span>
                      </div>
                    </button>
                    {advance && (
                      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                        <button className="btn btn-sm btn-primary" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); setStatus(s.id, advance); }}>
                          → {advance}
                        </button>
                        {col.id === "QC" && (
                          <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setStatus(s.id, "REJECTED"); }}>Reject</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {byStatus[col.id].length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 12 }}>—</div>
              )}
            </div>
            {col.id === "QC" && role === "ANALYST" && (
              <div style={{ padding: "8px 10px", borderTop: "1px solid var(--line)", display: "flex", gap: 6 }}>
                <Icon name="ai" size={12} style={{ color: "var(--accent)", marginTop: 2 }}/>
                <span style={{ fontSize: 11, color: "var(--ink-2)" }}>
                  Claude pre-screened <b>{byStatus.QC.length}</b> samples · {Math.max(1, Math.floor(byStatus.QC.length * 0.7))} match historical patterns, {Math.max(1, Math.floor(byStatus.QC.length * 0.3))} flagged for human review.
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Rejected stream */}
      <div className="card">
        <div className="card-head">
          <span className="card-title">Rejected Stream</span>
          <span className="card-sub mono">{rejected.length} SAMPLES · 28-DAY WINDOW</span>
        </div>
        <div className="card-body no-pad">
          {rejected.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>No rejected samples in window.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Sample</th><th>Asset</th><th>Reason</th><th>Rejected by</th><th>When</th></tr></thead>
              <tbody>
                {rejected.map(s => (
                  <tr key={s.id} onClick={() => focus(s.id, "sample")}>
                    <td className="mono t-id">{s.id}</td>
                    <td>{s.assetName} <span className="mono muted">· {s.assetTag}</span></td>
                    <td className="t-muted">{["Container leak", "Volume insufficient", "Mislabelled", "Contaminated container"][parseInt(s.id.slice(-1), 36) % 4]}</td>
                    <td>{s.analyst}</td>
                    <td className="mono t-muted">{window.fmtShortDate(s.receivedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

window.ScreenLifecycle = ScreenLifecycle;
