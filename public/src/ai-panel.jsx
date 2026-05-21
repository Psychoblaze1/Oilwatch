// ============================================================
// AI right-side panel — chat with Claude (live, streamed)
// ============================================================
function AIPanel({ onClose, focus, context }) {
  // Seed initial chat from live fleet so refs stay valid as data evolves.
  const sites = window.SITES.map(s => s.name).filter(Boolean).slice(0, 4).join(", ");
  const worst = window.ASSETS.slice().sort((a, b) => a.health - b.health)[0];
  const firstName = ((window.CURRENT_USER && window.CURRENT_USER.name) || "there").split(/\s+/)[0];
  const grounded = window.SAMPLES.length === 0
    ? `No samples on file yet — ${(window.SITES.length || 0)} site${window.SITES.length === 1 ? "" : "s"} registered.`
    : `Grounded on ${sites || "the lab"} · ${window.SAMPLES.length} samples · ${window.ASSETS.length} engines.`;
  const greeting = window.SAMPLES.length === 0
    ? `Hi ${firstName}. The lab is set up but nothing has been logged yet. Once you submit a sample I can help you triage results, draft owner notes, and explain the limits.`
    : worst
      ? `Hi ${firstName}. Overnight pass surfaced ${window.ASSETS.filter(a => a.health < 50).length} engines trending — want a recap, or jump straight into ${worst.name.split(" · ")[0]} (${worst.tag}, ${worst.classLabel})?`
      : `Hi ${firstName}. Fleet looks clean across the board overnight — anything you want me to dig into?`;
  const [messages, setMessages] = React.useState([
    { role: "system", text: grounded },
    { role: "ai", text: greeting, time: window.fmtTime(new Date()) },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  // When the user clicks Refresh on the last answer, skip the cache and
  // hit the model again. Resets to false after each turn.
  const [skipCache, setSkipCache] = React.useState(false);
  const scrollRef = React.useRef(null);
  const abortRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

  // Abort any in-flight stream when the panel unmounts (close button,
  // route change). Without this the SSE reader keeps running after the
  // component is gone and tries to setState on a dead tree.
  React.useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Collapse the design's structured messages into the user/assistant
  // pairs Anthropic's /v1/messages expects.
  const toAPI = (history, nextUser) => {
    const out = [];
    for (const m of history) {
      if (m.role === "user") out.push({ role: "user", content: m.text });
      else if (m.role === "ai") out.push({ role: "assistant", content: m.text });
    }
    out.push({ role: "user", content: nextUser });
    // API requires conversation to start with a user turn.
    while (out.length && out[0].role !== "user") out.shift();
    return out;
  };

  const sendMessage = async (text) => {
    if (!text.trim() || pending) return;
    const userMsg = { role: "user", text, time: window.fmtTime(new Date()) };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setPending(true);

    // Open an empty AI message we'll stream tokens into.
    const aiIndex = history.length;
    setMessages(m => [...m, { role: "ai", text: "", time: window.fmtTime(new Date()), citations: [], fromCache: false }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: toAPI(messages, text),
          context: context || {},
          options: { skipCache },
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "");
        setMessages(m => m.map((msg, i) => i === aiIndex
          ? { ...msg, text: "I couldn't reach the analysis service. " + (err || `(${res.status})`) }
          : msg));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let acc = "";
      const citationMap = new Map();
      let fromCache = false;
      let cacheHits = 0;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Each SSE message is `event:\ndata:\n\n` or `data:\n\n`. We
        // split on blank-line boundaries.
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          let event = "";
          let dataLines = [];
          for (const line of chunk.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
          }
          const payload = dataLines.join("\n");
          if (!payload || payload === "[DONE]") continue;

          // Lab88-only cache hint event.
          if (event === "lab88_cache") {
            try {
              const c = JSON.parse(payload);
              fromCache = true;
              cacheHits = c.hits || 0;
              for (const cite of (c.citations || [])) {
                if (cite.url) citationMap.set(cite.url, cite);
              }
              setMessages(m => m.map((msg, i) => i === aiIndex
                ? { ...msg, fromCache: true, cacheHits, citations: [...citationMap.values()] }
                : msg));
            } catch (_) {}
            continue;
          }

          try {
            const evt = JSON.parse(payload);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              acc += evt.delta.text;
              setMessages(m => m.map((msg, i) => i === aiIndex ? { ...msg, text: acc } : msg));
            }
            // Live web_search citations stream as content_block_start
            // with type=web_search_tool_result containing an array.
            if (evt.type === "content_block_start" && evt.content_block?.type === "web_search_tool_result") {
              for (const r of (evt.content_block.content || [])) {
                if (r.type === "web_search_result" && r.url) {
                  let domain = "";
                  try { domain = new URL(r.url).hostname.replace(/^www\./, ""); } catch (_) {}
                  citationMap.set(r.url, { url: r.url, title: r.title || r.url, domain, snippet: r.snippet || null });
                }
              }
              setMessages(m => m.map((msg, i) => i === aiIndex
                ? { ...msg, citations: [...citationMap.values()] } : msg));
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      if (e.name !== "AbortError") {
        setMessages(m => m.map((msg, i) => i === aiIndex
          ? { ...msg, text: "Network error: " + e.message }
          : msg));
      }
    } finally {
      setPending(false);
      setSkipCache(false);
      abortRef.current = null;
    }
  };
  const refreshLast = async () => {
    if (pending || messages.length < 2) return;
    // Find the most recent user message and re-send it with skipCache.
    const lastUser = [...messages].reverse().find(m => m.role === "user");
    if (!lastUser) return;
    setSkipCache(true);
    // Drop the previous AI response so we start fresh.
    setMessages(m => m.slice(0, m.length - 1));
    // Defer until state settles, then send.
    setTimeout(() => sendMessage(lastUser.text), 0);
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  return (
    <aside className="ai-panel" data-screen-label="ai-panel">
      <style>{`
        .ai-head { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-bottom: 1px solid var(--line); }
        .ai-head-mark { width: 28px; height: 28px; border-radius: 6px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .ai-head-title { font-weight: 600; font-size: 13px; }
        .ai-head-sub { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; font-family: var(--mono); }
        .ai-scroll { flex: 1; overflow: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 14px; }
        .ai-msg { display: flex; flex-direction: column; gap: 6px; }
        .ai-msg .role { font-size: 10px; letter-spacing: 0.12em; color: var(--ink-3); font-family: var(--mono); }
        .ai-msg .bubble { font-size: 13px; line-height: 1.5; color: var(--ink); white-space: pre-wrap; }
        .ai-msg.system .bubble { font-size: 11.5px; color: var(--ink-3); font-family: var(--mono); padding: 8px 10px; border-radius: 6px; background: var(--bg-sunken); border: 1px dashed var(--line); }
        .ai-msg.user .bubble { background: var(--accent); color: #fff; padding: 10px 12px; border-radius: 10px 10px 2px 10px; align-self: flex-end; max-width: 86%; }
        .ai-msg.user { align-items: flex-end; }
        .ai-msg.ai .bubble { background: var(--bg-sunken); padding: 10px 12px; border-radius: 10px 10px 10px 2px; max-width: 92%; }
        .ai-cites { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
        .ai-cite { display: flex; align-items: center; gap: 8px; padding: 6px 9px; border-radius: 6px; background: var(--bg-elev); border: 1px solid var(--line); font-size: 11.5px; cursor: pointer; }
        .ai-cite:hover { border-color: var(--accent-line); }
        .ai-cite .mono { color: var(--ink-3); font-size: 10.5px; }
        .ai-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
        .ai-chip { font-size: 11px; padding: 3px 8px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); border: 1px dashed var(--accent-line); cursor: pointer; }
        .ai-chip:hover { background: var(--accent); color: #fff; }
        .ai-form { border-top: 1px solid var(--line); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
        .ai-form-input { display: flex; gap: 8px; align-items: flex-end; padding: 10px 12px; border-radius: 10px; background: var(--bg-sunken); border: 1px solid transparent; }
        .ai-form-input:focus-within { border-color: var(--accent-line); background: var(--bg-elev); }
        .ai-form-input textarea { flex: 1; resize: none; background: none; border: 0; outline: 0; font-size: 13px; color: var(--ink); min-height: 22px; max-height: 120px; font-family: var(--sans); }
        .ai-form-input textarea::placeholder { color: var(--ink-3); }
        .ai-send { width: 32px; height: 32px; border-radius: 7px; background: var(--accent); color: #fff; display: grid; place-items: center; }
        .ai-send:disabled { background: var(--bg-sunken); color: var(--ink-3); }
        .ai-typing { display: flex; gap: 4px; padding: 8px 10px; }
        .ai-typing span { width: 6px; height: 6px; border-radius: 50%; background: var(--ink-3); animation: tdot 1.1s infinite ease-in-out; }
        .ai-typing span:nth-child(2) { animation-delay: 0.15s; }
        .ai-typing span:nth-child(3) { animation-delay: 0.30s; }
        @keyframes tdot { 0%, 80%, 100% { opacity: 0.3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
        .ai-foot { display: flex; gap: 6px; flex-wrap: wrap; }
        .ai-context { display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--ink-3); font-family: var(--mono); letter-spacing: 0.06em; }
        .ai-cache-badge { display: inline-flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--ok); margin-top: 4px; letter-spacing: 0.04em; }
        .ai-cache-refresh { margin-left: 8px; padding: 2px 8px; border-radius: 999px; background: var(--bg-sunken); color: var(--ink-2); font-size: 10.5px; border: 1px solid var(--line); }
        .ai-cache-refresh:hover { background: var(--bg); color: var(--ink); }
        .ai-web-cites { display: flex; flex-direction: column; gap: 5px; margin-top: 8px; }
        .ai-web-cites-head { font-size: 10px; color: var(--ink-3); letter-spacing: 0.12em; padding-bottom: 2px; }
        .ai-web-cite { display: block; padding: 7px 10px; border-radius: 6px; background: var(--bg-elev); border: 1px solid var(--line); text-decoration: none; color: var(--ink); }
        .ai-web-cite:hover { border-color: var(--accent-line); background: var(--bg); }
        .ai-web-cite-domain { display: inline-block; font-size: 10px; color: var(--accent); letter-spacing: 0.04em; }
        .ai-web-cite-title { display: inline-block; margin-left: 6px; font-size: 12px; }
        .ai-web-cite-snippet { font-size: 11px; color: var(--ink-3); margin-top: 4px; line-height: 1.4; }
      `}</style>

      <div className="ai-head">
        <div className="ai-head-mark"><Icon name="ai" size={15}/></div>
        <div>
          <div className="ai-head-title">Claude</div>
          <div className="ai-head-sub">SONNET · GROUNDED · {window.SAMPLES.length.toLocaleString()} SAMPLES</div>
        </div>
        <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={onClose} title="Close"><Icon name="close" size={14}/></button>
      </div>

      <div className="ai-scroll" ref={scrollRef}>
        {messages.map((m, i) => (
          <div key={i} className={`ai-msg ${m.role}`}>
            {m.role !== "system" && <span className="role">{m.role === "ai" ? "CLAUDE" : "YOU"}{m.time ? " · " + m.time : ""}</span>}
            <div className="bubble">
              {m.text}
              {m.role === "ai" && pending && i === messages.length - 1 && !m.text && (
                <div className="ai-typing"><span/><span/><span/></div>
              )}
            </div>
            {m.role === "ai" && m.fromCache && (
              <div className="ai-cache-badge mono">
                <Icon name="check" size={10}/> Served from cache · {m.cacheHits || 1} prior read{(m.cacheHits || 1) === 1 ? "" : "s"}
                {i === messages.length - 1 && !pending && (
                  <button className="ai-cache-refresh" onClick={refreshLast} title="Re-ask the model with fresh web search">Refresh</button>
                )}
              </div>
            )}
            {m.cites && (
              <div className="ai-cites">
                {m.cites.map((c, k) => (
                  <button key={k} className="ai-cite" onClick={() => focus(c.id, c.kind)}>
                    <Icon name={c.kind === "sample" ? "samples" : "assets"} size={12}/>
                    <span>{c.label}</span>
                    <span className="mono" style={{ marginLeft: "auto" }}>{c.id}</span>
                  </button>
                ))}
              </div>
            )}
            {m.role === "ai" && Array.isArray(m.citations) && m.citations.length > 0 && (
              <div className="ai-web-cites">
                <div className="ai-web-cites-head mono">SOURCES · {m.citations.length}</div>
                {m.citations.map((c, k) => (
                  <a key={k} href={c.url} target="_blank" rel="noopener" className="ai-web-cite" title={c.url}>
                    <span className="ai-web-cite-domain mono">{c.domain || "link"}</span>
                    <span className="ai-web-cite-title">{c.title || c.url}</span>
                    {c.snippet && <div className="ai-web-cite-snippet">{c.snippet}</div>}
                  </a>
                ))}
              </div>
            )}
            {m.actions && (
              <div className="ai-actions">
                {m.actions.map((a, k) => (
                  <button key={k} className="ai-chip" onClick={() => sendMessage(a)}>{a}</button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="ai-form">
        <div className="ai-context">
          <Icon name="dot" size={8} style={{ color: "var(--ok)" }}/> CONTEXT: {(context?.siteFilter && context.siteFilter !== "all") ? context.siteFilter.toUpperCase() : "ALL SITES"} · LAST 90 DAYS · PUBLISHED ONLY
        </div>
        <div className="ai-form-input">
          <textarea placeholder="Ask anything about samples, assets, trends…" value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKey} rows={1}/>
          <button className="ai-send" onClick={() => sendMessage(input)} disabled={!input.trim() || pending}><Icon name="send" size={14}/></button>
        </div>
        <div className="ai-foot">
          <button className="ai-chip" onClick={() => sendMessage("Summarize fleet health since last week.")}>Fleet summary</button>
          <button className="ai-chip" onClick={() => sendMessage("Top 5 assets at risk in next 30 days.")}>Top risks</button>
          <button className="ai-chip" onClick={() => sendMessage("Draft a customer-facing note for the worst sample today.")}>Draft note</button>
        </div>
      </div>
    </aside>
  );
}

window.AIPanel = AIPanel;
