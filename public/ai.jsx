/* ai.jsx — Atomic Capital: live Claude-powered AI layer
   --------------------------------------------------------------------------
   Everything that talks to a real model lives here:
     • streamAI()        — POSTs to /api/ai and streams the reply (SSE)
     • portfolioContext()— snapshots live holdings/watchlist for the model
     • <AIAssistant>     — slide-in co-pilot drawer (portfolio + risk aware)
     • <LiveAITake>      — on-demand live take for a single stock (detail view)
   The mock market data (data.js) stays the "live" feel; the model is called
   on demand so the dashboard itself stays instant. */

const AD_AI = window.AtomicData;

/* ---------------- streaming client ---------------- */
async function streamAI({ messages, context, onText, onCitation, onDone, onError, signal }) {
  let resp;
  try {
    resp = await fetch("/api/ai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages, context }),
      signal,
    });
  } catch (e) {
    onError && onError(e.message || "Network error");
    return;
  }
  if (!resp.ok || !resp.body) {
    const txt = await resp.text().catch(() => "");
    onError && onError(txt || "HTTP " + resp.status);
    return;
  }
  const reader = resp.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const chunks = buf.split("\n\n");
      buf = chunks.pop() || "";
      for (const chunk of chunks) {
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          let evt;
          try { evt = JSON.parse(payload); } catch (_) { continue; }
          if (evt.type === "text") onText && onText(evt.text);
          else if (evt.type === "citation") onCitation && onCitation(evt);
          else if (evt.type === "done") { onDone && onDone(); return; }
          else if (evt.type === "error") { onError && onError(evt.message); return; }
        }
      }
    }
  } catch (e) {
    if (e.name !== "AbortError") onError && onError(e.message || "Stream error");
    return;
  }
  onDone && onDone();
}

/* ---------------- live portfolio snapshot for the model ---------------- */
function portfolioContext() {
  const fx = AD_AI.USDZAR;
  let totalZar = 0, costZar = 0, dayZar = 0;
  const holdings = AD_AI.HOLDINGS.map((h) => {
    const s = AD_AI.get(h.sym);
    const value = h.shares * s.price, cost = h.shares * h.avg;
    const vZar = h.acct === "USD" ? value * fx : value;
    const cZar = h.acct === "USD" ? cost * fx : cost;
    totalZar += vZar; costZar += cZar;
    dayZar += h.acct === "USD" ? s.change * h.shares * fx : s.change * h.shares;
    return {
      sym: h.sym, name: s.name, sector: s.sector, account: h.acct,
      shares: h.shares, avgCost: h.avg, price: +s.price.toFixed(2),
      currency: s.cur, changePct: s.changePct,
      unrealisedPlPct: +(((value - cost) / cost) * 100).toFixed(1),
    };
  });
  return {
    blendedCurrency: "ZAR",
    usdZarRate: fx,
    totalValueZar: Math.round(totalZar),
    totalReturnZar: Math.round(totalZar - costZar),
    totalReturnPct: +(((totalZar - costZar) / costZar) * 100).toFixed(1),
    todayZar: Math.round(dayZar),
    buyingPowerZar: 24850,
    holdings,
    watchlist: AD_AI.WATCH.map((sym) => {
      const s = AD_AI.get(sym);
      return { sym, name: s.name, sector: s.sector, price: +s.price.toFixed(2), changePct: s.changePct };
    }),
  };
}

function stockContext(sym) {
  const s = AD_AI.get(sym);
  if (!s) return null;
  const held = AD_AI.HOLDINGS.find((h) => h.sym === sym);
  return {
    sym: s.sym, name: s.name, sector: s.sector, currency: s.cur,
    price: +s.price.toFixed(2), prevClose: s.prevClose, changePct: s.changePct,
    dayHigh: s.dayHigh, dayLow: s.dayLow, open: s.open,
    youHold: held ? { shares: held.shares, avgCost: held.avg } : null,
    recentHeadlines: (AD_AI.newsFor(sym) || []).map((n) => ({ src: n.src, title: n.title, sentiment: n.sent })),
  };
}

/* ---------------- drawer + bubble styles ---------------- */
const __AI_CSS = `
.ai-scrim { position: fixed; inset: 0; background: rgba(4,5,15,0.55); backdrop-filter: blur(2px);
  opacity: 0; pointer-events: none; transition: opacity var(--t-med) var(--ease-out); z-index: 90; }
.ai-scrim.on { opacity: 1; pointer-events: auto; }
.ai-drawer { position: fixed; top: 0; right: 0; bottom: 0; width: 440px; max-width: 92vw;
  background: var(--d-panel); border-left: 1px solid var(--d-line); z-index: 91;
  display: flex; flex-direction: column; transform: translateX(105%);
  transition: transform var(--t-slow) var(--ease-out); box-shadow: -30px 0 80px rgba(4,5,15,0.5); }
.ai-drawer.on { transform: translateX(0); }
.ai-dh { display: flex; align-items: center; gap: 12px; padding: 18px 20px; border-bottom: 1px solid var(--d-line); }
.ai-dh .ai-mark { width: 34px; height: 34px; border-radius: 9px; }
.ai-dh .t { flex: 1; }
.ai-dh .t b { font-family: var(--font-display); font-size: 15px; }
.ai-dh .t span { display: block; font-size: 11px; color: var(--d-fg-3); }
.ai-db { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
.ai-msg { font-size: 14px; line-height: 1.6; }
.ai-msg.u { align-self: flex-end; max-width: 86%; background: var(--accent-soft);
  border: 1px solid rgba(63,182,241,0.22); color: var(--d-fg); padding: 10px 14px; border-radius: 14px 14px 4px 14px; }
.ai-msg.a { align-self: flex-start; max-width: 96%; color: var(--d-fg-2); white-space: pre-wrap; }
.ai-msg.a .who { display: flex; align-items: center; gap: 8px; font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em; color: var(--d-fg-3); margin-bottom: 7px; }
.ai-msg.a .who .ai-mark { width: 20px; height: 20px; border-radius: 6px; }
.ai-cite { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.ai-cite a { font-size: 11px; color: var(--d-fg-2); background: rgba(255,255,255,0.05);
  border: 1px solid var(--d-line); padding: 3px 9px; border-radius: 999px; }
.ai-cite a:hover { border-color: var(--accent); color: var(--d-fg); }
.ai-suggest { display: flex; flex-direction: column; gap: 10px; }
.ai-suggest button { text-align: left; background: var(--d-card); border: 1px solid var(--d-line);
  color: var(--d-fg-2); border-radius: var(--r-md); padding: 12px 14px; font-family: var(--font-body);
  font-size: 13px; font-weight: 600; cursor: pointer; transition: all var(--t-fast) var(--ease-out); }
.ai-suggest button:hover { border-color: var(--accent); color: var(--d-fg); transform: translateY(-1px); }
.ai-df { padding: 14px 16px; border-top: 1px solid var(--d-line); }
.ai-input { display: flex; align-items: flex-end; gap: 10px; background: var(--d-card);
  border: 1px solid var(--d-line); border-radius: var(--r-lg); padding: 8px 8px 8px 14px; }
.ai-input:focus-within { border-color: var(--accent); }
.ai-input textarea { flex: 1; background: none; border: none; outline: none; resize: none; color: var(--d-fg);
  font-family: var(--font-body); font-size: 14px; line-height: 1.45; max-height: 120px; }
.ai-input textarea::placeholder { color: var(--d-fg-3); }
.ai-send { width: 36px; height: 36px; flex: none; border-radius: 10px; border: none; cursor: pointer;
  background: var(--accent); color: #04122a; display: grid; place-items: center; transition: filter var(--t-fast); }
.ai-send:hover { filter: brightness(1.08); }
.ai-send:disabled { opacity: 0.4; cursor: default; }
.ai-disclaimer { font-size: 10.5px; color: var(--d-fg-3); text-align: center; margin: 9px 2px 0; }
.ai-err { color: var(--down); font-size: 12px; }
`;
(function injectAICSS() {
  const el = document.createElement("style");
  el.textContent = __AI_CSS;
  document.head.appendChild(el);
})();

/* ---------------- co-pilot drawer ---------------- */
function AIMark({ style }) {
  return (
    <span className="ai-mark" style={style}><Ic.spark2 style={{ width: 15, height: 15, color: "#fff" }} /></span>
  );
}

function Citations({ items }) {
  if (!items || !items.length) return null;
  const seen = new Set();
  const uniq = items.filter((c) => (seen.has(c.url) ? false : (seen.add(c.url), true))).slice(0, 6);
  return (
    <div className="ai-cite">
      {uniq.map((c) => (
        <a key={c.url} href={c.url} target="_blank" rel="noreferrer" title={c.title || c.url}>
          {c.domain || c.title || "source"}
        </a>
      ))}
    </div>
  );
}

const AI_SUGGESTIONS = [
  "Is my portfolio too concentrated? What should I trim?",
  "When should I add to NVDA, and at what level?",
  "Summarise today's AI & quantum news and the read for me.",
  "I have R24 850 buying power — where would you deploy it?",
];

function AIAssistant({ open, onClose, risk, view, focusSym }) {
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);
  const abortRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, open]);

  useEffect(() => {
    if (open && taRef.current) setTimeout(() => taRef.current.focus(), 350);
  }, [open]);

  // Esc closes
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const send = (text) => {
    const q = (text != null ? text : input).trim();
    if (!q || busy) return;
    setInput("");
    const history = msgs
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.text))
      .map((m) => ({ role: m.role, content: m.text }));
    const next = [...msgs, { role: "user", text: q }, { role: "assistant", text: "", citations: [], pending: true }];
    setMsgs(next);
    setBusy(true);
    const ac = new AbortController();
    abortRef.current = ac;
    const apiMessages = [...history, { role: "user", content: q }];
    const context = { risk, view, portfolio: portfolioContext() };
    if (focusSym) context.stock = stockContext(focusSym);

    streamAI({
      messages: apiMessages,
      context,
      signal: ac.signal,
      onText: (t) => setMsgs((cur) => patchLast(cur, (m) => ({ ...m, text: m.text + t, pending: false }))),
      onCitation: (c) => setMsgs((cur) => patchLast(cur, (m) => ({ ...m, citations: [...(m.citations || []), c] }))),
      onError: (msg) => { setMsgs((cur) => patchLast(cur, (m) => ({ ...m, error: msg, pending: false }))); setBusy(false); },
      onDone: () => { setMsgs((cur) => patchLast(cur, (m) => ({ ...m, pending: false }))); setBusy(false); },
    });
  };

  const stop = () => { abortRef.current && abortRef.current.abort(); setBusy(false); };

  return (
    <>
      <div className={"ai-scrim " + (open ? "on" : "")} onClick={onClose} />
      <aside className={"ai-drawer " + (open ? "on" : "")} aria-hidden={!open}>
        <div className="ai-dh">
          <AIMark style={{ background: "var(--grad-mark)" }} />
          <div className="t"><b>Atomic AI</b><span>Investment co-pilot · {RISK[risk].label} · live</span></div>
          <div className="icon-btn" onClick={onClose} title="Close"><Ic.x /></div>
        </div>

        <div className="ai-db" ref={bodyRef}>
          {msgs.length === 0 && (
            <>
              <div className="aibox" style={{ padding: 16 }}>
                <div className="ai-hd" style={{ marginBottom: 8 }}>
                  <AIMark style={{ background: "var(--grad-mark)", width: 24, height: 24, borderRadius: 7 }} />
                  <strong style={{ fontSize: 13 }}>Ask about your book</strong>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "var(--d-fg-2)", lineHeight: 1.55 }}>
                  I can see your live EasyEquities holdings, watchlist and risk dial. Ask me when to invest,
                  what to trim, or to summarise the latest AI / quantum / computing news.
                </p>
              </div>
              <div className="ai-suggest">
                {AI_SUGGESTIONS.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
              </div>
            </>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="ai-msg u">{m.text}</div>
            ) : (
              <div key={i} className="ai-msg a">
                <div className="who"><AIMark style={{ background: "var(--grad-mark)" }} /> Atomic AI</div>
                {m.text}
                {m.pending && !m.text && <span className="typing" />}
                {m.error && <div className="ai-err">⚠ {m.error}</div>}
                <Citations items={m.citations} />
              </div>
            )
          )}
        </div>

        <div className="ai-df">
          <div className="ai-input">
            <textarea
              ref={taRef}
              rows={1}
              placeholder="Ask Atomic AI…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            {busy ? (
              <button className="ai-send" onClick={stop} title="Stop"><Ic.pause /></button>
            ) : (
              <button className="ai-send" onClick={() => send()} disabled={!input.trim()} title="Send"><Ic.arrow /></button>
            )}
          </div>
          <div className="ai-disclaimer">AI research, not financial advice. Verify before you trade.</div>
        </div>
      </aside>
    </>
  );
}

function patchLast(list, fn) {
  if (!list.length) return list;
  const out = list.slice();
  out[out.length - 1] = fn(out[out.length - 1]);
  return out;
}

/* ---------------- on-demand live take for the stock-detail view ---------------- */
function LiveAITake({ sym, risk }) {
  const [text, setText] = useState("");
  const [cites, setCites] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [ran, setRan] = useState(false);

  const run = () => {
    if (busy) return;
    setText(""); setCites([]); setErr(null); setBusy(true); setRan(true);
    const s = AD_AI.get(sym);
    const q = `Give me your current take on ${sym} (${s.name}). Should I buy, hold, sell or avoid right now — and specifically *when* should I act (price levels / triggers)? Factor in my position and the latest news. Keep it to a few tight sentences.`;
    streamAI({
      messages: [{ role: "user", content: q }],
      context: { risk, view: "detail", portfolio: portfolioContext(), stock: stockContext(sym) },
      onText: (t) => setText((cur) => cur + t),
      onCitation: (c) => setCites((cur) => [...cur, c]),
      onError: (m) => { setErr(m); setBusy(false); },
      onDone: () => setBusy(false),
    });
  };

  if (!ran) {
    return (
      <button className="btn btn-pri btn-sm" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={run}>
        <Ic.spark2 style={{ width: 14, height: 14 }} /> Live AI take
      </button>
    );
  }
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--d-line)" }}>
      <div className="who" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--d-fg-3)", marginBottom: 8 }}>
        <span className="ai-mark" style={{ width: 20, height: 20, borderRadius: 6 }}><Ic.spark2 style={{ width: 12, height: 12, color: "#fff" }} /></span>
        Live take · web-aware
        {!busy && <span style={{ marginLeft: "auto", cursor: "pointer", color: "var(--accent)" }} onClick={run}><Ic.refresh style={{ width: 13, height: 13 }} /></span>}
      </div>
      <p className={"sc-rzn " + (busy && !text ? "typing" : "")} style={{ margin: 0, whiteSpace: "pre-wrap" }}>{text}</p>
      {err && <div className="ai-err" style={{ color: "var(--down)", fontSize: 12, marginTop: 8 }}>⚠ {err}</div>}
      <Citations items={cites} />
    </div>
  );
}

Object.assign(window, { streamAI, portfolioContext, stockContext, AIAssistant, LiveAITake });
