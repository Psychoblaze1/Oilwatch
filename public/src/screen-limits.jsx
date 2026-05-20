// ============================================================
// Limits — per asset-class threshold editor.
//
// Two tabs by section:
//   * Oil  — warn / alarm / target on aviation + industrial + custom oil params.
//   * Diesel — min / max / range on SANS 342 params + custom diesel params.
//
// Edits round-trip via window.setLimit → /api/limits.
// ============================================================
function ScreenLimits({ role, section }) {
  const canEdit = role === "MANAGER" || role === "ADMIN";
  const [sec, setSec] = React.useState(section || "oil");
  React.useEffect(() => { if (section) setSec(section); }, [section]);

  // Scope picker — built-in fleet default + every asset class that
  // belongs to the active section. (Custom classes flow in
  // automatically because window.ASSET_CLASSES is server-managed.)
  const classes = [
    { id: "all", label: "Fleet default" },
    ...window.ASSET_CLASSES.filter(c => c.section === sec),
  ];
  const [scope, setScope] = React.useState("all");
  React.useEffect(() => { setScope("all"); }, [sec]);

  const [, force] = React.useReducer(x => x + 1, 0);
  const limits = window.getLimits(scope);

  // Params we render depends on the active section. Custom params are
  // merged in by data.jsx so we don't have to special-case them here.
  const params = sec === "diesel" ? window.allDieselParams() : window.allOilParams();

  const onChange = async (paramCode, field, raw) => {
    if (!canEdit) return;
    const n = raw === "" ? null : parseFloat(raw);
    const parsed = (raw === "" || isFinite(n)) ? n : undefined;
    if (parsed === undefined) return;
    await window.setLimit(scope, paramCode, { [field]: parsed });
    force();
  };

  const onReset = async () => {
    if (!canEdit) return;
    if (!confirm(`Reset ${scope === "all" ? "fleet" : scope} limits to defaults?`)) return;
    await window.resetLimits(scope);
    force();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Editing Limits</h1>
          <div className="page-sub">Per-parameter thresholds. Changes apply to new sample evaluations immediately.</div>
        </div>
        <div className="page-actions">
          {!canEdit && <Tag>READ-ONLY · MANAGER required</Tag>}
          {canEdit && <button className="btn btn-ghost" onClick={onReset}><Icon name="trash" size={13}/> Reset scope</button>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button className={`btn btn-sm ${sec === "oil" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSec("oil")}>Oil parameters</button>
        <button className={`btn btn-sm ${sec === "diesel" ? "btn-primary" : "btn-ghost"}`} onClick={() => setSec("diesel")}>Diesel parameters</button>
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
          <span className="card-sub mono">SCOPE: {scope.toUpperCase()} · {params.length} PARAMETERS · {sec === "diesel" ? "MIN / MAX / RANGE" : "WARN / ALARM"}</span>
        </div>
        <div className="card-body no-pad">
          <table className="table">
            <thead>
              <tr>
                <th>Parameter</th><th>Unit</th><th>Method</th>
                {sec === "diesel"
                  ? (<><th>Dir</th><th>Min</th><th>Max</th></>)
                  : (<><th>Target</th><th>Warn</th><th>Alarm</th></>)}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {params.map(p => {
                const lim = limits[p.code] || p;
                const isInfo = p.dir === "info";
                const overridden =
                  (lim.warn ?? null) !== (p.warn ?? null) ||
                  (lim.alarm ?? null) !== (p.alarm ?? null) ||
                  (lim.target ?? null) !== (p.target ?? null) ||
                  (lim.min ?? null) !== (p.min ?? null) ||
                  (lim.max ?? null) !== (p.max ?? null);
                return (
                  <tr key={p.code} style={{ cursor: "default" }} onClick={(e) => e.stopPropagation()}>
                    <td>
                      <span className="mono t-id" style={{ marginRight: 8 }}>{p.code}</span>{p.name}
                      {p.isCustom && <Tag tone="accent" style={{ marginLeft: 6 }}>CUSTOM</Tag>}
                    </td>
                    <td className="mono t-muted">{p.unit}</td>
                    <td className="mono t-muted">{p.method}</td>
                    {sec === "diesel" ? (
                      <>
                        <td className="mono t-muted">{lim.dir || p.dir || "info"}</td>
                        <td className="mono">
                          {!isInfo && canEdit
                            ? <input className="lim-input mono" defaultValue={lim.min ?? ""} type="number" step="any"
                                     onBlur={(e) => onChange(p.code, "min", e.target.value)} />
                            : <span>{lim.min ?? "—"}</span>}
                        </td>
                        <td className="mono">
                          {!isInfo && canEdit
                            ? <input className="lim-input mono" defaultValue={lim.max ?? ""} type="number" step="any"
                                     onBlur={(e) => onChange(p.code, "max", e.target.value)} />
                            : <span>{lim.max ?? "—"}</span>}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="mono">
                          {p.target != null
                            ? (canEdit
                                ? <input className="lim-input mono" defaultValue={lim.target ?? ""} type="number" step="any"
                                         onBlur={(e) => onChange(p.code, "target", e.target.value)} />
                                : <span>{lim.target ?? "—"}</span>)
                            : <span className="muted">—</span>}
                        </td>
                        <td className="mono">
                          {canEdit && typeof p.warn === "number"
                            ? <input className="lim-input mono" defaultValue={lim.warn ?? ""} type="number" step="any"
                                     onBlur={(e) => onChange(p.code, "warn", e.target.value)} />
                            : <span>{lim.warn ?? "—"}</span>}
                        </td>
                        <td className="mono">
                          {canEdit && typeof p.alarm === "number"
                            ? <input className="lim-input mono" defaultValue={lim.alarm ?? ""} type="number" step="any"
                                     onBlur={(e) => onChange(p.code, "alarm", e.target.value)} />
                            : <span>{lim.alarm ?? "—"}</span>}
                        </td>
                      </>
                    )}
                    <td>{overridden ? <Tag tone="accent">OVERRIDE</Tag> : <Tag>DEFAULT</Tag>}</td>
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
