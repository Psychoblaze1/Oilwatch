// ============================================================
// AI right-side panel — chat with Claude (live, streamed)
// ============================================================
function AIPanel({ onClose, focus, context }) {
  // Seed initial chat from live fleet so refs stay valid as data evolves.
  const sites = window.SITES.map(s => s.name.replace(/(Flight Academy|FBO|Charter|Aero Service|Flying Club|Bush Operators)/, "").trim()).filter(Boolean).slice(0, 4).join(", ");
  const worst = window.ASSETS.slice().sort((a, b) => a.health - b.health)[0];
  const [messages, setMessages] = React.useState([
    { role: "system", text: `Grounded on ${sites}, +2 more · ${window.SAMPLES.length} samples · ${window.ASSETS.length} engines.` },
    { role: "ai",
      text: worst
        ? `Morning Devon. Overnight pass surfaced ${window.ASSETS.filter(a => a.health < 50).length} engines trending — want a recap, or jump straight into ${worst.name.split(" · ")[0]} (${worst.tag}, ${worst.classLabel})?`
        : "Morning Devon. Fleet looks clean across the board overnight — anything you want me to dig into?",
      time: "06:14" },
  ]);
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const scrollRef = React.useRef(null);
  const abortRef = React.useRef(null);

  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, pending]);

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
    setMessages(m => [...m, { role: "ai", text: "", time: window.fmtTime(new Date()) }]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: toAPI(messages, text),
          context: context || {},
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

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // Anthropic SSE: lines like "event: content_block_delta\ndata: {...}\n\n"
        const chunks = buf.split("\n\n");
        buf = chunks.pop() || "";
        for (const chunk of chunks) {
          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const evt = JSON.parse(payload);
              if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
                acc += evt.delta.text;
                setMessages(m => m.map((msg, i) => i === aiIndex ? { ...msg, text: acc } : msg));
              }
            } catch (_) { /* skip non-JSON keep-alives */ }
          }
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
      abortRef.current = null;
    }
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
      `}</style>

      <div className="ai-head">
        <div className="ai-head-mark"><Icon name="ai" size={15}/></div>
        <div>
          <div className="ai-head-title">Claude</div>
          <div className="ai-head-sub">SONNET · GROUNDED · 1,243 SAMPLES</div>
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
