// ============================================================
// Limits — per asset-class warn/alarm threshold editor.
// Overrides persist in localStorage and flow through makeTestResults,
// so editing here actually changes sample evaluation downstream.
// Wire to /api/limits in the future by replacing the read/write helpers
// in data.jsx (getLimits / setLimit / resetLimits).
// ============================================================
function ScreenLimits({ role }) {
  const canEdit = role === "MANAGER" || role === "ADMIN";
  const classes = [
    { id: "all",  label: "Fleet default" },
    ...window.ASSET_CLASSES,
  ];
  const [scope, setScope] = React.useState("all");
  // bump triggers re-resolution of limits after writes.
  const [, force] = React.useReducer(x => x + 1, 0);
  const limits = window.getLimits(scope);

  const onChange = (paramCode, field, raw) => {
    if (!canEdit) return;
    const def = window.PARAM_DEFS.find(p => p.code === paramCode);
    let parsed = raw;
    if (def.kind === "num") {
      const n = parseFloat(raw);
      parsed = isNaN(n) ? def[field] : n;
    }
    window.setLimit(scope, paramCode, { [field]: parsed });
    force();
  };

  const onReset = () => {
    if (!canEdit) return;
    if (!confirm(`Reset ${scope === "all" ? "fleet" : scope} limits to defaults?`)) return;
    window.resetLimits(scope);
    force();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Editing Limits</h1>
          <div className="page-sub">Warn / alarm thresholds per parameter, per asset class. Changes apply to new sample evaluations immediately.</div>
        </div>
        <div className="page-actions">
          {!canEdit && <Tag>READ-ONLY · MANAGER required</Tag>}
          {canEdit && <button className="btn btn-ghost" onClick={onReset}><Icon name="trash" size={13}/> Reset scope</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {classes.map(c => (
          <button key={c.id} className={`btn btn-sm ${scope === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setScope(c.id)}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title">Thresholds</span>
          <span className="card-sub mono">SCOPE: {scope.toUpperCase()} · {window.PARAM_DEFS.length} PARAMETERS</span>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Unit</th>
                <th>Method</th>
                <th>Target</th>
                <th>Warn</th>
                <th>Alarm</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {window.PARAM_DEFS.map(p => {
                const lim = limits[p.code];
                const isNum = p.kind === "num";
                const overridden =
                  lim.warn !== p.warn || lim.alarm !== p.alarm ||
                  (lim.target ?? null) !== (p.target ?? null);
                return (
                  <tr key={p.code} style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                    <td>
                      <span className="mono t-id" style={{ marginRight: 8 }}>{p.code}</span>{p.name}
                    </td>
                    <td className="mono t-muted">{p.unit}</td>
                    <td className="mono t-muted">{p.method}</td>
                    <td className="mono">
                      {isNum && p.target != null
                        ? (canEdit
                            ? <input className="lim-input mono" defaultValue={lim.target ?? ""} type="number" step="any"
                                     onBlur={(e) => onChange(p.code, "target", e.target.value)} />
                            : <span>{lim.target ?? "—"}</span>)
                        : <span className="muted">—</span>}
                    </td>
                    <td className="mono">
                      {canEdit && isNum
                        ? <input className="lim-input mono" defaultValue={lim.warn} type="number" step="any"
                                 onBlur={(e) => onChange(p.code, "warn", e.target.value)} />
                        : <span>{lim.warn}</span>}
                    </td>
                    <td className="mono">
                      {canEdit && isNum
                        ? <input className="lim-input mono" defaultValue={lim.alarm} type="number" step="any"
                                 onBlur={(e) => onChange(p.code, "alarm", e.target.value)} />
                        : <span>{lim.alarm}</span>}
                    </td>
                    <td>
                      {overridden ? <Tag tone="accent">OVERRIDE</Tag> : <Tag>DEFAULT</Tag>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        .lim-input {
          width: 90px; padding: 4px 8px; border-radius: 6px;
          background: var(--bg-sunken); border: 1px solid transparent;
          color: var(--ink); font-size: 12.5px;
        }
        .lim-input:focus { outline: 0; border-color: var(--accent-line); background: var(--bg-elev); }
      `}</style>
    </div>
  );
}

window.ScreenLimits = ScreenLimits;
