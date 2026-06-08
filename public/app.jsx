/* app.jsx — Atomic Capital shell */
const { useState: uS, useEffect: uE, useRef: uR } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#3FB6F1",
  "motion": true,
  "tickSpeed": 1.6,
  "chartStyle": "gradient"
}/*EDITMODE-END*/;

function useClock() {
  const [now, setNow] = uS(new Date());
  uE(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  return now;
}

/* ---- search ---- */
function Search({ onOpen }) {
  const [q, setQ] = uS("");
  const [focus, setFocus] = uS(false);
  const matches = q ? AD.list().filter(s => (s.sym + " " + s.name).toLowerCase().includes(q.toLowerCase())).slice(0, 6) : [];
  return (
    <div style={{ position: "relative" }}>
      <div className="search">
        <Ic.search/>
        <input placeholder="Search NVDA, IONQ, quantum…" value={q}
          onChange={e => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}/>
        <kbd>/</kbd>
      </div>
      {focus && matches.length > 0 && (
        <div className="card" style={{ position: "absolute", top: 48, left: 0, right: 0, padding: 6, zIndex: 30, boxShadow: "var(--shadow-lg)" }}>
          {matches.map(s => (
            <div key={s.sym} onMouseDown={() => { onOpen(s.sym); setQ(""); }} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 8, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <Logo sym={s.sym} color={s.color} size={28}/>
              <div style={{ flex: 1 }}><div className="sy" style={{ fontSize: 13 }}>{s.sym}</div><div className="nm" style={{ fontSize: 11, color: "var(--d-fg-3)" }}>{s.name}</div></div>
              <span className="mono" style={{ fontSize: 13 }}>{fmtMoney(s.price, s.cur)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setView] = uS("portfolio");
  const [sym, setSym] = uS(null);
  const [risk, setRisk] = uS("bal");
  const [aiOpen, setAiOpen] = uS(false);
  const now = useClock();
  const mainRef = uR(null);

  // apply accent
  uE(() => {
    window.AC_FILL = TWEAK_DEFAULTS.chartStyle;
  }, []);

  // ⌘K / Ctrl-K toggles the AI co-pilot drawer
  uE(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setAiOpen(v => !v); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // apply accent
  uE(() => {
    const root = document.documentElement;
    root.style.setProperty("--accent", t.accent);
    root.style.setProperty("--accent-soft", `color-mix(in srgb, ${t.accent} 14%, transparent)`);
    window.AC_FILL = t.chartStyle;
  }, [t.accent, t.chartStyle]);

  // live feed
  uE(() => {
    AD.stopFeed();
    if (t.motion) AD.startFeed(Math.round(t.tickSpeed * 1000));
    return () => AD.stopFeed();
  }, [t.motion, t.tickSpeed]);

  const open = (s) => { setSym(s); setView("detail"); mainRef.current && (mainRef.current.scrollTop = 0); };
  const go = (v) => { setView(v); setSym(null); mainRef.current && (mainRef.current.scrollTop = 0); };

  const ses = AD.sessions();
  const sigCount = AD.SIGNALS.filter(s => s.action === "buy" || s.action === "sell").length;

  const nav = [
    ["portfolio", "Portfolio", Ic.grid],
    ["watch", "Watchlist", Ic.eye],
    ["signals", "AI signals", Ic.spark2, sigCount],
    ["markets", "Market pulse", Ic.pulse],
  ];

  return (
    <div className="app">
      {/* sidebar */}
      <aside className="side">
        <div className="brand">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <defs><linearGradient id="bm" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
              <stop stopColor="#5E0EEC"/><stop offset="0.55" stopColor="#2A5BD7"/><stop offset="1" stopColor="#3FB6F1"/>
            </linearGradient></defs>
            <path d="M16 3 L29 28 H21.5 L16 16 L10.5 28 H3 Z" fill="url(#bm)"/>
            <circle cx="16" cy="22" r="2.4" fill="#0A0B1A"/>
          </svg>
          <div><div className="bn">Atomic Capital</div><div className="bt">Fluid markets lab</div></div>
        </div>
        <div className="nav-label">Tracking</div>
        {nav.map(([id, label, I, badge]) => (
          <div key={id} className={"nav-item " + ((view === id || (id === "portfolio" && view === "detail" && false)) ? "active" : "")} onClick={() => go(id)}>
            <I/><span>{label}</span>{badge ? <span className="badge">{badge}</span> : null}
          </div>
        ))}
        <div className="side-foot">
          <div className="acct">
            <div className="av">M</div>
            <div style={{ flex: 1 }}><div className="nm">My EasyEquities</div><div className="br">USD + ZAR · {AD.holdingsSource === "easyequities" ? "synced" : "sample"}</div></div>
            <Ic.arrow style={{ width: 15, height: 15, color: "var(--d-fg-3)" }}/>
          </div>
        </div>
      </aside>

      {/* topbar */}
      <header className="top">
        <Search onOpen={open}/>
        <div className="mkt">
          <div className="mkt-chip"><span className={"dot " + (ses.jse.open ? "open" : "closed")}/> JSE {ses.jse.open ? "open" : "closed"}</div>
          <div className="mkt-chip"><span className={"dot " + (ses.nyse.open ? "open" : "closed")}/> NYSE {ses.nyse.open ? "open" : "closed"}</div>
          <div className="mkt-chip" title={AD.live ? "Real-time market data" : "Sample data — live prices need the server"}><span className={"dot " + (AD.live ? "open" : "closed")}/> {AD.live ? "Live data" : "Sample"}</div>
        </div>
        <div className="top-right">
          <span className="clock">{now.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} SAST</span>
          <div className="risk">
            <span className="risk-lbl">Risk</span>
            <div className="seg">
              <button className={"cons " + (risk === "cons" ? "on" : "")} onClick={() => setRisk("cons")}>Cautious</button>
              <button className={"bal " + (risk === "bal" ? "on" : "")} onClick={() => setRisk("bal")}>Balanced</button>
              <button className={"agg " + (risk === "agg" ? "on" : "")} onClick={() => setRisk("agg")}>Bold</button>
            </div>
          </div>
          <button className="btn btn-pri btn-sm" onClick={() => setAiOpen(true)} title="Ask Atomic AI (⌘K)">
            <Ic.spark2 style={{ width: 15, height: 15 }}/> Ask AI <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.7, marginLeft: 2 }}>⌘K</kbd>
          </button>
          <div className="icon-btn"><Ic.bell/><span className="ndot"/></div>
        </div>
      </header>

      {/* main */}
      <main className="main" ref={mainRef}>
        <div className="main-inner">
          {view === "portfolio" && <PortfolioView onOpen={open} risk={risk}/>}
          {view === "watch" && <WatchView onOpen={open}/>}
          {view === "signals" && <SignalsView onOpen={open} risk={risk}/>}
          {view === "markets" && <MarketsView onOpen={open}/>}
          {view === "detail" && sym && <DetailView sym={sym} risk={risk} onBack={() => go("portfolio")}/>}
        </div>
      </main>

      {/* tweaks */}
      <TweaksPanel>
        <TweakSection label="Appearance"/>
        <TweakColor label="Accent" value={t.accent} options={["#3FB6F1", "#8C3FCF", "#2DD597", "#C73B8A"]} onChange={v => setTweak("accent", v)}/>
        <TweakRadio label="Chart style" value={t.chartStyle} options={["gradient", "line"]} onChange={v => setTweak("chartStyle", v)}/>
        <TweakSection label="Live data"/>
        <TweakToggle label="Live ticking" value={t.motion} onChange={v => setTweak("motion", v)}/>
        <TweakSlider label="Tick speed" value={t.tickSpeed} min={0.6} max={4} step={0.2} unit="s" onChange={v => setTweak("tickSpeed", v)}/>
      </TweaksPanel>

      {/* AI co-pilot (Claude-powered) */}
      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} risk={risk} view={view} focusSym={view === "detail" ? sym : null}/>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
