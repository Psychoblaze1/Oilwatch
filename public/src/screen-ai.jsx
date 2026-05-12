// ============================================================
// AI Studio screen — chat surface + prompt library + history
// ============================================================
function ScreenAI({ focus, openAI }) {
  const presets = [
    { t: "Which Lycoming engines have crossed 2σ on iron in the last 60 days?", icon: "spark" },
    { t: "Summarize fleet health changes since last week and rank by criticality.", icon: "spark" },
    { t: "For the worst-trending engine, project hours-to-cam-scope using the last 8 samples.", icon: "spark" },
    { t: "Find samples matching the classic cam/lifter wear pattern (Fe + Cr running together).", icon: "spark" },
    { t: "Draft an owner-facing root-cause note for sample S-50312 in plain English.", icon: "spark" },
    { t: "What resample cadence should I recommend for low-utilization Lycoming O-540s?", icon: "spark" },
  ];

  const recent = [
    { q: "Compare AeroShell W100 Plus vs Phillips X/C 20W-50 on cam-area wear-metal generation for IO-540s.", t: "2 hours ago", scope: "Fleet · 412 samples" },
    { q: "Which 5 engines are most likely to need cam pull in the next 30 days?",                            t: "Yesterday",  scope: "Fleet · all operators" },
    { q: "Why is lead in piston-aircraft oil normally 4,000–7,000 ppm? Is high Pb ever actionable?",         t: "2 days ago", scope: "Reference" },
    { q: "Pull all samples where Fe + Cr both have +3 consecutive increases.",                              t: "Last week",  scope: "Filter query" },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Studio</h1>
          <div className="page-sub">Claude Sonnet · grounded on your lab data, OEM specs, and historical failures</div>
        </div>
        <div className="page-actions">
          <Tag tone="accent">claude-sonnet-4-6</Tag>
          <button className="btn btn-ghost"><Icon name="settings" size={14}/> Prompts</button>
          <button className="btn btn-primary" onClick={openAI}><Icon name="plus" size={14}/> New chat</button>
        </div>
      </div>

      {/* Hero ask */}
      <div className="card" style={{ marginBottom: 16, borderColor: "var(--accent-line)" }}>
        <div className="card-body" style={{ padding: 22 }}>
          <div style={{ fontSize: 11.5, letterSpacing: 0.1, color: "var(--accent)", marginBottom: 8, fontWeight: 600 }}>ASK ANYTHING ABOUT YOUR FLEET</div>
          <div style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px", borderRadius: 10, border: "1px solid var(--line)",
            background: "var(--bg-elev)"
          }}>
            <Icon name="ai" size={18} style={{ color: "var(--accent)" }}/>
            <input
              placeholder="e.g. Rank Lycoming O-540s by likelihood of cam pull in the next quarter…"
              onClick={openAI}
              style={{ flex: 1, background: "none", border: 0, outline: 0, fontSize: 14 }}
            />
            <button className="btn btn-primary btn-sm" onClick={openAI}>
              <Icon name="send" size={12}/> Ask
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, fontSize: 11, color: "var(--ink-3)" }}>
            <span className="mono">SCOPE</span>
            <Tag tone="accent">All operators</Tag>
            <Tag>Last 90 days</Tag>
            <Tag>Published only</Tag>
            <span className="mono" style={{ marginLeft: "auto" }}>{window.SAMPLES.length.toLocaleString()} SAMPLES · {window.ASSETS.length} ENGINES GROUNDED</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head"><span className="card-title">Starter Prompts</span><span className="card-sub mono">CURATED FOR RELIABILITY ENGINEERING</span></div>
          <div className="card-body no-pad">
            {presets.map((p, i) => (
              <button key={i} onClick={openAI} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 12, alignItems: "center", width: "100%",
                padding: "12px 16px", borderBottom: i < presets.length - 1 ? "1px solid var(--line)" : "none", textAlign: "left"
              }}>
                <Icon name="spark" size={13} style={{ color: "var(--accent)" }}/>
                <span style={{ fontSize: 13 }}>{p.t}</span>
                <Icon name="chevron-r" size={12} style={{ color: "var(--ink-3)" }}/>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><span className="card-title">Recent Threads</span></div>
          <div className="card-body no-pad">
            {recent.map((r, i) => (
              <button key={i} onClick={openAI} style={{
                display: "block", width: "100%", padding: "12px 16px", textAlign: "left",
                borderBottom: i < recent.length - 1 ? "1px solid var(--line)" : "none"
              }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>{r.q}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.06 }}>
                  {r.t.toUpperCase()} · {r.scope.toUpperCase()}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head">
          <span className="card-title">Grounded On</span>
          <span className="card-sub mono">DATA SOURCES IN THIS WORKSPACE</span>
        </div>
        <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          {[
            { l: "Sample database",     n: window.SAMPLES.length.toLocaleString(), s: "Published, last 90 d" },
            { l: "Engine registry",     n: String(window.ASSETS.length),           s: "All operators" },
            { l: "Engine specs",        n: "32",                                   s: "Lycoming, Continental, Rotax, P&W, …" },
            { l: "Historical patterns", n: "94",                                   s: "Resolved cam/lifter & cylinder cases" },
          ].map((d, i) => (
            <div key={i} style={{ padding: 14, background: "var(--bg-sunken)", borderRadius: 8 }}>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.1, textTransform: "uppercase" }}>{d.l}</div>
              <div className="mono" style={{ fontSize: 22, fontWeight: 600, marginTop: 4 }}>{d.n}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 2 }}>{d.s}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

window.ScreenAI = ScreenAI;
