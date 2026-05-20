// ============================================================
// App shell — sidebar, topbar, status code chip
// ============================================================

function userInitials(u) {
  if (!u || !u.name) return "··";
  return u.name.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}

const Chip = ({ code, children, size = "sm" }) => {
  const c = window.COND[code] || window.COND[1];
  return (
    <span className={`chip chip-${c.color} chip-${size}`}>
      <span className="chip-dot" />
      <span className="chip-text">{children || c.label}</span>
    </span>
  );
};

const Kbd = ({ children }) => <span className="kbd mono">{children}</span>;

const Tag = ({ children, tone = "neutral" }) => <span className={`tag tag-${tone}`}>{children}</span>;

function Sidebar({ route, setRoute, role, setRole, openAI }) {
  const items = [
    { id: "dashboard", icon: "dashboard", label: "Dashboard" },
    { id: "samples",   icon: "samples",   label: "Samples" },
    { id: "log-sample",icon: "plus",      label: "Log Sample" },
    { id: "lifecycle", icon: "lifecycle", label: "Lifecycle" },
    { id: "assets",    icon: "assets",    label: "Assets" },
    { id: "alarms",    icon: "alarm",     label: "Alarms",   count: window.ALARMS.filter(a => !a.acknowledged).length },
    { id: "ai",        icon: "ai",        label: "AI Studio" },
    { id: "ai-library",icon: "ref",       label: "AI Library" },
    { id: "limits",    icon: "limits",    label: "Limits" },
    { id: "rules",     icon: "rules",     label: "Rules" },
    { id: "manage",    icon: "settings",  label: "Manage" },
    { id: "ref",       icon: "ref",       label: "Reference" },
  ];
  return (
    <aside className="side">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M12 3c3.5 4.5 5.5 7.2 5.5 10.2A5.5 5.5 0 0 1 12 19a5.5 5.5 0 0 1-5.5-5.8C6.5 10.2 8.5 7.5 12 3z" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">Lab88</div>
          <div className="brand-sub mono">Lab88 VU · v4.2</div>
        </div>
      </div>

      <nav className="nav">
        {items.map(it => (
          <button key={it.id} className={`nav-item ${route === it.id ? "is-active" : ""}`} onClick={() => setRoute(it.id)}>
            <Icon name={it.icon} size={16} />
            <span className="nav-label">{it.label}</span>
            {it.count > 0 && <span className="nav-count mono">{it.count}</span>}
          </button>
        ))}
      </nav>

      <div className="side-bottom">
        <button className="ai-cta" onClick={openAI}>
          <Icon name="ai" size={16} />
          <span>Ask Claude</span>
          <Kbd>⌘ K</Kbd>
        </button>

        <RoleSwitcher role={role} setRole={setRole} />
      </div>
    </aside>
  );
}

function RoleSwitcher({ role, setRole }) {
  const [open, setOpen] = React.useState(false);
  const current = window.ROLES.find(r => r.id === role);
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!e.target.closest(".role-wrap")) setOpen(false); };
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [open]);
  return (
    <div className="role-wrap">
      <button className="role-btn" onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}>
        <div className="role-avatar mono">{userInitials(window.CURRENT_USER)}</div>
        <div className="role-meta">
          <div className="role-name">{(window.CURRENT_USER && window.CURRENT_USER.name) || "Operator"}</div>
          <div className="role-role mono">
            {current.label.toUpperCase()}
            {window.CURRENT_USER && window.CURRENT_USER.email ? " · " + window.CURRENT_USER.email : ""}
          </div>
        </div>
        <Icon name="chevron" size={14} style={{ marginLeft: "auto", opacity: 0.6 }} />
      </button>
      {open && (
        <div className="role-pop">
          <div className="role-pop-head mono">SWITCH ROLE</div>
          {window.ROLES.map(r => (
            <button key={r.id} className={`role-pop-item ${r.id === role ? "is-active" : ""}`} onClick={() => { setRole(r.id); setOpen(false); }}>
              <div className="role-pop-label">{r.label}</div>
              <div className="role-pop-hint mono">{r.hint}</div>
              {r.id === role && <Icon name="check" size={14} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Topbar({ site, setSite, route, openAI, onSearch, dark, onToggleTheme, section, setSection }) {
  const titles = {
    dashboard: "Fleet Overview",
    samples:   "Samples",
    "log-sample": "Log Sample",
    lifecycle: "Sample Lifecycle",
    assets:    "Assets",
    alarms:    "Alarms",
    ai:        "AI Studio",
    "ai-library": "AI Library",
    limits:    "Editing Limits",
    rules:     "Rules Engine",
    manage:    "Manage",
    ref:       "Reference Library",
    sample:    "Sample",
    asset:     "Asset",
  };
  const [siteOpen, setSiteOpen] = React.useState(false);
  React.useEffect(() => {
    if (!siteOpen) return;
    const h = (e) => { if (!e.target.closest(".site-sw")) setSiteOpen(false); };
    document.addEventListener("click", h); return () => document.removeEventListener("click", h);
  }, [siteOpen]);
  const sites = [{ id: "all", name: "All Sites", code: "·", region: `${window.SITES.length} sites` }, ...window.SITES];
  const current = sites.find(s => s.id === site) || sites[0];

  return (
    <header className="top">
      <div className="top-left">
        <div className="crumbs mono">
          <span className="crumb-pre">LAB88</span>
          <span className="crumb-sep">/</span>
          <span className="crumb-cur">{(titles[route] || route).toUpperCase()}</span>
        </div>
        {setSection && (
          <div className="section-sw" role="tablist" aria-label="Lab section">
            {(window.SECTIONS || []).map(s => (
              <button key={s.id} role="tab" aria-selected={section === s.id}
                      className={`section-tab ${section === s.id ? "is-active" : ""}`}
                      onClick={() => setSection(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="top-search">
        <Icon name="search" size={15} style={{ opacity: 0.55 }} />
        <input placeholder="Search assets, samples, barcodes…" onChange={(e) => onSearch && onSearch(e.target.value)} />
        <Kbd>/</Kbd>
      </div>

      <div className="top-right">
        <div className="site-sw">
          <button className="site-btn" onClick={(e) => { e.stopPropagation(); setSiteOpen(o => !o); }}>
            <Icon name="site" size={14} />
            <span>{current.name}</span>
            <Icon name="chevron" size={13} style={{ opacity: 0.55 }} />
          </button>
          {siteOpen && (
            <div className="site-pop">
              {sites.map(s => (
                <button key={s.id} className={`site-pop-item ${s.id === site ? "is-active" : ""}`} onClick={() => { setSite(s.id); setSiteOpen(false); }}>
                  <div className="spi-name">{s.name}</div>
                  <div className="spi-meta mono">{s.code} · {s.region}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="icon-btn" onClick={onToggleTheme} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
          <Icon name={dark ? "sun" : "moon"} size={16} />
        </button>
        <button className="icon-btn" onClick={openAI} title="Ask Claude"><Icon name="ai" size={16} /></button>
        <button className="icon-btn" title="Notifications"><Icon name="alarm" size={16} /></button>
        <button className="icon-btn" title="Settings"><Icon name="settings" size={16} /></button>
      </div>
    </header>
  );
}

// ============================================================
// Shell styles, injected once
// ============================================================
const ShellStyles = () => (
  <style>{`
    .app { display: grid; grid-template-columns: 232px 1fr; min-height: 100vh; background: var(--bg); }
    .app.with-ai { grid-template-columns: 232px 1fr 380px; }

    /* Sidebar */
    .side {
      background: var(--bg-side);
      color: var(--ink-side);
      display: flex; flex-direction: column;
      border-right: 1px solid var(--line-side);
    }
    .brand { display: flex; align-items: center; gap: 10px; padding: 18px 16px 16px; border-bottom: 1px solid var(--line-side); }
    .brand-mark { width: 30px; height: 30px; border-radius: 7px; background: var(--accent); color: #fff; display: grid; place-items: center; }
    .brand-name { font-weight: 600; letter-spacing: -0.01em; font-size: 14px; }
    .brand-sub { font-size: 10px; color: var(--ink-side-3); letter-spacing: 0.08em; }

    .nav { display: flex; flex-direction: column; gap: 1px; padding: 12px 8px; flex: 1; }
    .nav-item {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 6px;
      color: var(--ink-side-2); font-size: 13px;
      transition: background 80ms, color 80ms;
    }
    .nav-item:hover { background: var(--bg-side-elev); color: var(--ink-side); }
    .nav-item.is-active { background: var(--bg-side-elev); color: var(--ink-side); }
    .nav-item.is-active::before {
      content: ""; width: 2px; height: 14px; background: var(--accent);
      position: absolute; margin-left: -10px; border-radius: 2px;
    }
    .nav-label { flex: 1; }
    .nav-count {
      font-size: 10px; background: rgba(255,255,255,0.06); color: var(--ink-side-2);
      padding: 1px 6px; border-radius: 8px; min-width: 16px; text-align: center;
    }

    .side-bottom { padding: 10px; border-top: 1px solid var(--line-side); display: flex; flex-direction: column; gap: 8px; }
    .ai-cta {
      display: flex; align-items: center; gap: 8px;
      padding: 9px 10px; border-radius: 7px;
      background: rgba(255,255,255,0.04);
      color: var(--ink-side); font-size: 12.5px;
      border: 1px solid var(--line-side);
    }
    .ai-cta:hover { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.15); }
    .ai-cta .kbd { margin-left: auto; }

    .kbd {
      font-size: 10.5px; padding: 1px 5px; border-radius: 4px;
      background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12);
      color: var(--ink-side-2);
    }

    .role-wrap { position: relative; }
    .role-btn {
      display: flex; align-items: center; gap: 9px;
      padding: 8px 10px; border-radius: 7px; width: 100%;
      background: transparent; color: var(--ink-side);
    }
    .role-btn:hover { background: rgba(255,255,255,0.04); }
    .role-avatar {
      width: 28px; height: 28px; border-radius: 6px;
      background: var(--accent); color: #fff;
      display: grid; place-items: center; font-size: 11px; font-weight: 600;
    }
    .role-meta { text-align: left; line-height: 1.2; }
    .role-name { font-size: 12.5px; }
    .role-role { font-size: 10px; color: var(--ink-side-3); letter-spacing: 0.06em; margin-top: 2px; }
    .role-pop {
      position: absolute; bottom: calc(100% + 6px); left: 0; right: 0;
      background: var(--bg-side-elev); border: 1px solid var(--line-side);
      border-radius: 8px; padding: 6px; z-index: 100;
      box-shadow: 0 8px 30px rgba(0,0,0,0.4);
    }
    .role-pop-head { font-size: 10px; color: var(--ink-side-3); letter-spacing: 0.15em; padding: 6px 8px 4px; }
    .role-pop-item {
      display: flex; align-items: center; gap: 8px; width: 100%;
      padding: 7px 8px; border-radius: 5px; color: var(--ink-side); text-align: left;
    }
    .role-pop-item:hover { background: rgba(255,255,255,0.06); }
    .role-pop-item.is-active { background: rgba(255,255,255,0.08); }
    .role-pop-label { font-size: 12.5px; }
    .role-pop-hint { font-size: 10px; color: var(--ink-side-3); letter-spacing: 0.04em; }

    /* Topbar */
    .top {
      display: grid; grid-template-columns: 1fr minmax(280px, 420px) auto; gap: 16px; align-items: center;
      padding: 0 22px; height: 56px;
      background: var(--bg-elev); border-bottom: 1px solid var(--line);
      position: sticky; top: 0; z-index: 50;
    }
    .top-left { display: flex; align-items: center; gap: 16px; }
    .section-sw {
      display: inline-flex; align-items: center; gap: 2px;
      padding: 3px; border-radius: 8px;
      background: var(--bg-sunken); border: 1px solid var(--line);
    }
    .section-tab {
      padding: 4px 12px; border-radius: 6px;
      font-size: 12px; font-weight: 500; color: var(--ink-2);
      background: transparent; border: 0;
    }
    .section-tab:hover { color: var(--ink); }
    .section-tab.is-active {
      background: var(--accent); color: #fff;
    }
    .crumbs { font-size: 11px; letter-spacing: 0.12em; color: var(--ink-3); }
    .crumb-pre { color: var(--ink-3); }
    .crumb-sep { color: var(--ink-4); margin: 0 8px; }
    .crumb-cur { color: var(--ink); }
    .top-search {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 12px; border-radius: 8px;
      background: var(--bg-sunken); border: 1px solid transparent;
      transition: border-color 100ms;
    }
    .top-search:focus-within { border-color: var(--accent-line); background: var(--bg-elev); }
    .top-search input { flex: 1; background: none; border: 0; outline: 0; font-size: 13px; color: var(--ink); }
    .top-search input::placeholder { color: var(--ink-3); }

    .top-right { display: flex; align-items: center; gap: 8px; }
    .icon-btn {
      width: 32px; height: 32px; border-radius: 7px;
      display: grid; place-items: center; color: var(--ink-2);
      border: 1px solid transparent;
    }
    .icon-btn:hover { background: var(--bg-sunken); color: var(--ink); }
    .site-sw { position: relative; }
    .site-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; border-radius: 7px;
      background: var(--bg-sunken); color: var(--ink); font-size: 12.5px;
    }
    .site-btn:hover { background: var(--bg); border-color: var(--line); }
    .site-pop {
      position: absolute; top: calc(100% + 6px); right: 0; min-width: 260px;
      background: var(--bg-elev); border: 1px solid var(--line); border-radius: 8px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.08); padding: 6px; z-index: 100;
    }
    .site-pop-item { display: block; width: 100%; text-align: left; padding: 8px 10px; border-radius: 6px; }
    .site-pop-item:hover { background: var(--bg-sunken); }
    .site-pop-item.is-active { background: var(--accent-soft); }
    .spi-name { font-size: 13px; color: var(--ink); }
    .spi-meta { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; margin-top: 2px; }

    /* Main */
    .main { overflow: auto; max-height: 100vh; }
    .page { padding: 24px 28px 64px; max-width: 1480px; margin: 0 auto; }
    .page-header { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 22px; gap: 16px; }
    .page-title { font-size: 26px; font-weight: 600; letter-spacing: -0.015em; margin: 0; }
    .page-sub { font-size: 13px; color: var(--ink-3); margin-top: 4px; }
    .page-actions { display: flex; gap: 8px; align-items: center; }

    /* Cards */
    .card {
      background: var(--bg-elev);
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
    }
    .card-head { display: flex; align-items: center; gap: 10px; padding: 13px 16px; border-bottom: 1px solid var(--line); }
    .card-title { font-size: 12px; font-weight: 600; letter-spacing: 0.08em; color: var(--ink-2); text-transform: uppercase; }
    .card-sub { font-size: 11px; color: var(--ink-3); margin-left: auto; }
    .card-body { padding: 16px; }
    .card-body.no-pad { padding: 0; }

    /* Buttons */
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 7px; font-size: 12.5px; border: 1px solid var(--line); background: var(--bg-elev); color: var(--ink); transition: background 80ms; }
    .btn:hover { background: var(--bg-sunken); }
    .btn-primary { background: var(--accent); border-color: var(--accent); color: #fff; }
    .btn-primary:hover { background: color-mix(in oklab, var(--accent), black 10%); }
    .btn:disabled, .btn[disabled] { opacity: 0.45; cursor: not-allowed; pointer-events: none; }
    .btn-ghost { background: transparent; border-color: transparent; }
    .btn-ghost:hover { background: var(--bg-sunken); }
    .btn-sm { padding: 4px 9px; font-size: 11.5px; }

    /* Chips */
    .chip { display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-family: var(--mono); letter-spacing: 0.04em; font-weight: 500; }
    .chip-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .chip-ok    { background: var(--ok-bg);   color: var(--ok); }
    .chip-warn  { background: var(--warn-bg); color: var(--warn); }
    .chip-crit  { background: var(--crit-bg); color: var(--crit); }
    .chip-sev   { background: var(--sev-bg);  color: var(--sev); }
    html[data-theme="dark"] .chip-sev { color: var(--ink); }
    .chip-md { padding: 3px 10px; font-size: 11.5px; }

    .tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-family: var(--mono); letter-spacing: 0.04em; }
    .tag-neutral { background: var(--bg-sunken); color: var(--ink-2); }
    .tag-accent  { background: var(--accent-soft); color: var(--accent); }

    /* KPI grid */
    .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 16px; }
    .kpi { padding: 14px 16px; background: var(--bg-elev); border: 1px solid var(--line); border-radius: 10px; }
    .kpi-label { font-size: 10.5px; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; font-family: var(--mono); }
    .kpi-value { font-size: 26px; font-weight: 600; letter-spacing: -0.02em; margin-top: 6px; font-family: var(--mono); }
    .kpi-meta { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 11.5px; color: var(--ink-3); }
    .kpi-meta .delta-up   { color: var(--crit); display: inline-flex; align-items: center; gap: 2px; }
    .kpi-meta .delta-dn   { color: var(--ok);   display: inline-flex; align-items: center; gap: 2px; }
    .kpi-meta .delta-flat { color: var(--ink-3); }

    .grid-2 { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }

    /* Heatmap */
    .heatmap { padding: 6px 8px 14px; }
    .heatmap-head, .heatmap-row { display: grid; grid-template-columns: 160px repeat(6, 1fr); gap: 6px; align-items: stretch; padding: 4px 0; }
    .heatmap-head .heatmap-col-label { font-size: 10px; letter-spacing: 0.1em; color: var(--ink-3); text-transform: uppercase; font-family: var(--mono); padding: 0 4px; }
    .heatmap-row { border-top: 1px solid var(--line); padding: 8px 0; }
    .heatmap-row-label { padding: 0 4px; }
    .hm-site { font-size: 13px; color: var(--ink); }
    .hm-region { font-size: 10px; color: var(--ink-3); letter-spacing: 0.06em; margin-top: 2px; }
    .heatmap-cell { display: flex; align-items: center; }
    .hm-grid { display: grid; grid-template-columns: repeat(var(--n), 1fr); gap: 3px; width: 100%; }
    .hm-dot {
      aspect-ratio: 1; min-height: 18px; border-radius: 4px;
      display: grid; place-items: center; color: var(--ink-2);
      font-size: 9px; font-family: var(--mono); font-weight: 500;
      border: 1px solid transparent; transition: transform 80ms;
    }
    .hm-dot:hover { transform: scale(1.15); z-index: 2; outline: 1px solid var(--ink); }
    .hm-dot.c-1 { background: var(--ok-bg);   color: var(--ok); }
    .hm-dot.c-2 { background: var(--warn-bg); color: var(--warn); }
    .hm-dot.c-3 { background: var(--crit-bg); color: var(--crit); }
    .hm-dot.c-4 { background: var(--sev);     color: #fff; }
    .hm-dot-score { font-feature-settings: "tnum" 1; }
    .hm-empty { width: 100%; height: 18px; background: transparent; }

    /* Tables */
    .table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
    .table thead th {
      text-align: left; padding: 10px 14px; font-size: 10.5px; letter-spacing: 0.1em;
      text-transform: uppercase; color: var(--ink-3); font-family: var(--mono);
      border-bottom: 1px solid var(--line); background: var(--bg-sunken);
      font-weight: 500;
    }
    .table tbody td { padding: 11px 14px; border-bottom: 1px solid var(--line); color: var(--ink); }
    .table tbody tr:hover { background: var(--bg-sunken); cursor: pointer; }
    .table tbody tr:last-child td { border-bottom: 0; }
    .t-id { color: var(--ink-2); }
    .t-muted { color: var(--ink-3); }

    .muted { color: var(--ink-3); }
    .ink-2 { color: var(--ink-2); }

    /* RUL */
    .rul-bar { display: flex; flex-direction: column; gap: 4px; }
    .rul-track { height: 5px; background: var(--bg-sunken); border-radius: 4px; overflow: hidden; }
    .rul-fill { height: 100%; border-radius: 4px; }
    .rul-meta { display: flex; gap: 6px; font-size: 11px; }

    /* Inline AI badge */
    .ai-hint {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 3px 8px 3px 6px; border-radius: 999px;
      background: var(--accent-soft); color: var(--accent);
      font-size: 10.5px; font-weight: 500; letter-spacing: 0.04em;
      border: 1px dashed var(--accent-line);
    }
    .ai-hint svg { opacity: 0.9; }

    /* Sample status pill */
    .status-pill {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 2px 8px; border-radius: 4px; font-size: 10.5px; font-family: var(--mono); font-weight: 500;
      background: var(--bg-sunken); color: var(--ink-2); letter-spacing: 0.06em;
    }
    .status-pill[data-s="DRAFT"]     { background: var(--bg-sunken); color: var(--ink-3); }
    .status-pill[data-s="QC"]        { background: var(--accent-soft); color: var(--accent); }
    .status-pill[data-s="APPROVED"]  { background: rgba(47,125,79,0.10); color: var(--ok); }
    .status-pill[data-s="PUBLISHED"] { background: rgba(47,125,79,0.18); color: var(--ok); }
    .status-pill[data-s="REJECTED"]  { background: var(--crit-bg); color: var(--crit); }

    /* AI right panel */
    .ai-panel {
      border-left: 1px solid var(--line);
      background: var(--bg-elev);
      display: flex; flex-direction: column;
      max-height: 100vh;
      position: sticky; top: 0;
    }

    @media (max-width: 1180px) {
      .kpi-row { grid-template-columns: repeat(3, 1fr); }
      .grid-2 { grid-template-columns: 1fr; }
    }
  `}</style>
);

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.Chip = Chip;
window.Kbd = Kbd;
window.Tag = Tag;
window.ShellStyles = ShellStyles;
