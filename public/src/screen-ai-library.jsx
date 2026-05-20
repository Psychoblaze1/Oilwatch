// ============================================================
// AI Library — browse cached AI answers + every web citation Lab88
// has ever surfaced. Pulls from /api/ai/library.
// ============================================================

function ScreenAILibrary({ section, focus }) {
  const [q, setQ] = React.useState("");
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState("answers");   // "answers" | "sources"

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.api.aiLibrary({ section, q, limit: 200 });
      setItems(r.responses || []);
    } catch (e) {
      setItems([]);
    } finally { setLoading(false); }
  }, [section, q]);
  React.useEffect(() => { load(); }, [load]);

  // Sources tab: flat list of every citation, grouped by domain.
  const sourcesByDomain = React.useMemo(() => {
    const out = {};
    for (const r of items) {
      for (const c of (r.citations || [])) {
        if (!c.url) continue;
        const d = c.domain || "other";
        out[d] = out[d] || [];
        out[d].push({ ...c, responseId: r.id, question: r.userQuestion, assetId: r.assetId });
      }
    }
    return out;
  }, [items]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">AI Library</h1>
          <div className="page-sub">
            Every question Claude has answered for this lab, with the web sources it cited. Cached for {section ? section : "both"} sections.
          </div>
        </div>
        <div className="page-actions">
          <div className="top-search" style={{ minWidth: 280 }}>
            <Icon name="search" size={14} style={{ opacity: 0.5 }}/>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search questions, answers, citations…"/>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <button className={`btn btn-sm ${view === "answers" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("answers")}>Answers ({items.length})</button>
        <button className={`btn btn-sm ${view === "sources" ? "btn-primary" : "btn-ghost"}`} onClick={() => setView("sources")}>Sources ({Object.keys(sourcesByDomain).length} domain{Object.keys(sourcesByDomain).length === 1 ? "" : "s"})</button>
      </div>

      {loading ? (
        <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--ink-3)" }}>Loading…</div></div>
      ) : items.length === 0 ? (
        <div className="card"><div className="card-body" style={{ textAlign: "center", color: "var(--ink-3)", padding: 24 }}>
          Nothing here yet. Open the AI panel and ask a question — answers cache automatically.
        </div></div>
      ) : view === "answers" ? (
        <div className="ai-lib-list">
          {items.map(r => (
            <div key={r.id} className="card ai-lib-card">
              <div className="card-head">
                <span className="card-title" style={{ textTransform: "none", letterSpacing: 0, fontSize: 13 }}>{r.userQuestion}</span>
                <span className="card-sub mono">
                  {r.section && r.section.toUpperCase()} · {r.assetId ? r.assetId : "FLEET"} · {r.hits} REPLAY{r.hits === 1 ? "" : "S"}
                </span>
              </div>
              <div className="card-body">
                <div className="ai-lib-answer">{r.responseText}</div>
                {r.citations && r.citations.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
                    {r.citations.map((c, k) => (
                      <a key={k} href={c.url} target="_blank" rel="noopener" className="ai-lib-cite mono">
                        <span style={{ color: "var(--accent)" }}>{c.domain || "link"}</span>
                        <span style={{ marginLeft: 8 }}>{c.title || c.url}</span>
                      </a>
                    ))}
                  </div>
                )}
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 10, letterSpacing: 0.06 }}>
                  CACHED {window.fmtShortDate(new Date(r.createdAt))}
                  {r.assetId && <button className="btn btn-sm btn-ghost" style={{ marginLeft: 10 }} onClick={() => focus && focus(r.assetId, "asset")}>Open asset</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid-3">
          {Object.entries(sourcesByDomain).sort((a, b) => b[1].length - a[1].length).map(([domain, cites]) => (
            <div key={domain} className="card">
              <div className="card-head">
                <span className="card-title" style={{ textTransform: "none", letterSpacing: 0 }}>{domain}</span>
                <span className="card-sub mono">{cites.length} CITATION{cites.length === 1 ? "" : "S"}</span>
              </div>
              <div className="card-body no-pad">
                {cites.slice(0, 40).map((c, k) => (
                  <a key={k} href={c.url} target="_blank" rel="noopener" style={{
                    display: "block", padding: "10px 14px",
                    borderBottom: k < cites.length - 1 ? "1px solid var(--line)" : "none",
                    color: "var(--ink)", textDecoration: "none",
                  }}>
                    <div style={{ fontSize: 12.5 }}>{c.title || c.url}</div>
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 3 }}>{c.question}</div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .ai-lib-list { display: flex; flex-direction: column; gap: 12px; }
        .ai-lib-card .ai-lib-answer { font-size: 13px; line-height: 1.55; white-space: pre-wrap; color: var(--ink); }
        .ai-lib-cite { display: block; font-size: 11.5px; color: var(--ink-2); text-decoration: none; padding: 4px 6px; border-radius: 4px; }
        .ai-lib-cite:hover { background: var(--bg-sunken); color: var(--ink); }
      `}</style>
    </div>
  );
}

window.ScreenAILibrary = ScreenAILibrary;
