// ============================================================
// Rules engine — declarative rules over sample parameters.
// Each rule = scope (asset classes) + AND'd conditions + severity + action.
// Persisted to localStorage via data.jsx helpers; future server route
// is /api/rules.
// ============================================================

const OPS = [
  { id: ">",     label: ">" },
  { id: ">=",    label: "≥" },
  { id: "<",     label: "<" },
  { id: "<=",    label: "≤" },
  { id: "abs%>", label: "|Δ%| >" },
  { id: "z>",    label: "z-score >" },
  { id: "trend+",label: "trend ↑ N" },
  { id: "trend-",label: "trend ↓ N" },
];

const SEVERITIES = ["WARN", "CRITICAL", "SEVERE"];
const ACTIONS = [
  { id: "alarm",  label: "Raise alarm" },
  { id: "notify", label: "Notify analyst" },
  { id: "flag",   label: "Flag for review" },
];

function ScreenRules({ role }) {
  const canEdit = role === "ANALYST" || role === "MANAGER" || role === "ADMIN";
  const [rules, setRules] = React.useState(() => window.getRules());
  const [editing, setEditing] = React.useState(null); // rule object or null

  const refresh = () => setRules(window.getRules());

  const onToggle = (rule) => {
    if (!canEdit) return;
    window.saveRule({ ...rule, enabled: !rule.enabled });
    refresh();
  };
  const onDelete = (rule) => {
    if (!canEdit) return;
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    window.deleteRule(rule.id);
    refresh();
  };
  const onNew = () => {
    setEditing({
      id: window.nextRuleId(),
      name: "",
      enabled: true,
      severity: "WARN",
      scope: { classes: "all" },
      conditions: [{ param: "Fe", op: ">", value: 30 }],
      action: "alarm",
      createdAt: new Date().toISOString(),
      lastTriggered: null,
    });
  };
  const onSave = (rule) => {
    window.saveRule(rule);
    setEditing(null);
    refresh();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Rules Engine</h1>
          <div className="page-sub">{rules.filter(r => r.enabled).length} active · {rules.length - rules.filter(r => r.enabled).length} disabled · evaluated on every QC sample</div>
        </div>
        <div className="page-actions">
          {!canEdit && <Tag>READ-ONLY · ANALYST required</Tag>}
          {canEdit && <button className="btn btn-primary" onClick={onNew}><Icon name="plus" size={14}/> New rule</button>}
        </div>
      </div>

      <div className="card">
        <div className="card-body no-pad">
          {rules.length === 0 && (
            <div style={{ padding: 32, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              No rules yet. Click <b>New rule</b> to create your first one.
            </div>
          )}
          {rules.map((r, i) => (
            <div key={r.id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr auto auto auto auto", gap: 16, alignItems: "center",
              padding: "14px 18px", borderBottom: i < rules.length - 1 ? "1px solid var(--line)" : "none",
              opacity: r.enabled ? 1 : 0.55,
            }}>
              <button className={`rule-toggle ${r.enabled ? "on" : ""}`} onClick={() => onToggle(r)} title={r.enabled ? "Disable" : "Enable"}>
                <span className="rule-toggle-dot"/>
              </button>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500 }}>{r.name || <span className="muted">Unnamed rule</span>}</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{r.id}</span>
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-2)", letterSpacing: 0.04 }}>
                  WHEN {r.conditions.map((c, k) => (
                    <span key={k}>
                      {k > 0 && <span style={{ color: "var(--accent)" }}> AND </span>}
                      <b>{c.param}</b> {OPS.find(o => o.id === c.op)?.label || c.op} <b>{c.value}</b>
                      {c.window ? ` (n=${c.window})` : ""}
                    </span>
                  ))}
                </div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3, letterSpacing: 0.04 }}>
                  SCOPE: {r.scope?.classes === "all" || !r.scope?.classes
                    ? "ALL CLASSES"
                    : (Array.isArray(r.scope.classes) ? r.scope.classes.join(", ").toUpperCase() : String(r.scope.classes).toUpperCase())}
                  {r.lastTriggered ? ` · LAST FIRED ${new Date(r.lastTriggered).toLocaleDateString()}` : " · NEVER FIRED"}
                </div>
              </div>
              <Chip code={r.severity === "WARN" ? 2 : r.severity === "CRITICAL" ? 3 : 4}>{r.severity}</Chip>
              <span className="mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                {ACTIONS.find(a => a.id === r.action)?.label || r.action}
              </span>
              {canEdit && <button className="btn btn-sm btn-ghost" onClick={() => setEditing({ ...r })}>Edit</button>}
              {canEdit && <button className="btn btn-sm btn-ghost" onClick={() => onDelete(r)} title="Delete"><Icon name="trash" size={13}/></button>}
            </div>
          ))}
        </div>
      </div>

      {editing && (
        <RuleEditor
          rule={editing}
          onCancel={() => setEditing(null)}
          onSave={onSave}
        />
      )}

      <style>{`
        .rule-toggle {
          width: 32px; height: 18px; border-radius: 999px; background: var(--bg-sunken);
          border: 1px solid var(--line); position: relative; padding: 0; cursor: pointer;
          transition: background 100ms, border-color 100ms;
        }
        .rule-toggle.on { background: var(--accent); border-color: var(--accent); }
        .rule-toggle-dot {
          position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%;
          background: var(--bg-elev); transition: transform 120ms;
        }
        .rule-toggle.on .rule-toggle-dot { transform: translateX(14px); background: #fff; }
        .rule-modal-bg {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: grid; place-items: center; z-index: 200;
        }
        .rule-modal {
          width: min(680px, 92vw); max-height: 88vh; overflow: auto;
          background: var(--bg-elev); border: 1px solid var(--line); border-radius: 12px;
          box-shadow: 0 14px 40px rgba(0,0,0,0.25);
        }
        .rule-form { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
        .rule-row { display: grid; grid-template-columns: 110px 1fr; gap: 12px; align-items: center; }
        .rule-row label { font-size: 11px; letter-spacing: 0.1em; color: var(--ink-3); font-family: var(--mono); text-transform: uppercase; }
        .rule-input, .rule-select {
          padding: 7px 10px; border-radius: 7px;
          background: var(--bg-sunken); border: 1px solid transparent;
          color: var(--ink); font-size: 13px; width: 100%;
        }
        .rule-input:focus, .rule-select:focus { outline: 0; border-color: var(--accent-line); background: var(--bg-elev); }
        .rule-cond { display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px; align-items: center; }
      `}</style>
    </div>
  );
}

function RuleEditor({ rule, onCancel, onSave }) {
  const [draft, setDraft] = React.useState(rule);
  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const setCond = (i, patch) => {
    const next = draft.conditions.slice();
    next[i] = { ...next[i], ...patch };
    set({ conditions: next });
  };
  const addCond = () => set({ conditions: [...draft.conditions, { param: "Fe", op: ">", value: 0 }] });
  const rmCond  = (i) => set({ conditions: draft.conditions.filter((_, k) => k !== i) });

  const scopeClasses = draft.scope?.classes;
  const isAllScope = scopeClasses === "all" || !scopeClasses;
  const setScopeAll = () => set({ scope: { classes: "all" } });
  const toggleScopeClass = (id) => {
    const cur = Array.isArray(scopeClasses) ? scopeClasses : [];
    const next = cur.includes(id) ? cur.filter(c => c !== id) : [...cur, id];
    set({ scope: { classes: next.length ? next : "all" } });
  };

  const canSave = draft.name.trim() && draft.conditions.length > 0;

  return (
    <div className="rule-modal-bg" onClick={onCancel}>
      <div className="rule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head">
          <span className="card-title">{rule.createdAt && draft.id === rule.id && draft.name === rule.name ? "Edit rule" : "New rule"}</span>
          <span className="card-sub mono">{draft.id}</span>
        </div>
        <div className="rule-form">
          <div className="rule-row">
            <label>Name</label>
            <input className="rule-input" autoFocus placeholder="e.g. Iron run-up"
              value={draft.name} onChange={e => set({ name: e.target.value })} />
          </div>

          <div className="rule-row">
            <label>Severity</label>
            <select className="rule-select" value={draft.severity} onChange={e => set({ severity: e.target.value })}>
              {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="rule-row">
            <label>Action</label>
            <select className="rule-select" value={draft.action} onChange={e => set({ action: e.target.value })}>
              {ACTIONS.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
          </div>

          <div className="rule-row" style={{ alignItems: "flex-start" }}>
            <label>Scope</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              <button type="button" className={`btn btn-sm ${isAllScope ? "btn-primary" : "btn-ghost"}`} onClick={setScopeAll}>
                All classes
              </button>
              {window.ASSET_CLASSES.map(c => {
                const on = Array.isArray(scopeClasses) && scopeClasses.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`btn btn-sm ${on ? "btn-primary" : "btn-ghost"}`} onClick={() => toggleScopeClass(c.id)}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rule-row" style={{ alignItems: "flex-start" }}>
            <label>Conditions</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {draft.conditions.map((c, i) => (
                <div key={i} className="rule-cond">
                  <select className="rule-select" value={c.param} onChange={e => setCond(i, { param: e.target.value })}>
                    {window.PARAM_DEFS.map(p => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
                  </select>
                  <select className="rule-select" value={c.op} onChange={e => setCond(i, { op: e.target.value })}>
                    {OPS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                  <input className="rule-input" type="number" step="any" value={c.value}
                    onChange={e => setCond(i, { value: parseFloat(e.target.value) })} />
                  <button type="button" className="btn btn-sm btn-ghost" disabled={draft.conditions.length === 1} onClick={() => rmCond(i)}>
                    <Icon name="close" size={13}/>
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm btn-ghost" onClick={addCond} style={{ alignSelf: "flex-start" }}>
                <Icon name="plus" size={12}/> Add condition (AND)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
            <button className="btn btn-primary" disabled={!canSave} onClick={() => onSave(draft)}>
              <Icon name="check" size={13}/> Save rule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.ScreenRules = ScreenRules;
