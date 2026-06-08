/* views2.jsx — Signals, Markets, Stock detail */

/* typewriter for AI takes */
function useTypewriter(text, speed = 14, on = true) {
  const [out, setOut] = useState(on ? "" : text);
  useEffect(() => {
    if (!on) { setOut(text); return; }
    setOut(""); let i = 0;
    const id = setInterval(() => { i++; setOut(text.slice(0, i)); if (i >= text.length) clearInterval(id); }, speed);
    return () => clearInterval(id);
  }, [text, on]);
  return out;
}

/* model target / stop from action + risk */
function levels(s, action, risk) {
  const k = { cons: 0.6, bal: 1, agg: 1.5 }[risk];
  if (action === "sell") return { target: s.price * (1 - 0.10 * k), stop: s.price * (1 + 0.05), dir: "down" };
  if (action === "hold") return { target: s.price * (1 + 0.05 * k), stop: s.price * (1 - 0.08), dir: "flat" };
  return { target: s.price * (1 + 0.12 * k), stop: s.price * (1 - 0.07 - 0.02 * k), dir: "up" };
}

/* ============================== AI SIGNALS ============================== */
function SignalsView({ onOpen, risk }) {
  useTick();
  const r = RISK[risk];
  const accentMap = { buy: "var(--up)", sell: "var(--down)", hold: "var(--hold)" };
  return (
    <div>
      <div className="page-head">
        <div><h1>AI signals</h1><p className="sub">When to act, and why — tuned to your risk appetite</p></div>
      </div>

      <div className="aibox rise" style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 16 }}>
        <span className="ai-mark" style={{ width: 38, height: 38, borderRadius: 10 }}><Ic.spark2 style={{ width: 20, height: 20 }}/></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Reasoning set to <span style={{ color: "var(--accent)" }}>{r.label}</span></div>
          <div style={{ fontSize: 13, color: "var(--d-fg-2)" }}>{r.blurb} Switch the dial in the top bar to re-tune every call below.</div>
        </div>
        <div className="tag"><Ic.refresh style={{ width: 13, height: 13 }}/> Updated 2 min ago</div>
      </div>

      <div className="grid g-2">
        {AD.SIGNALS.map((sig, i) => {
          const s = AD.get(sig.sym);
          const lv = levels(s, sig.action, risk);
          return (
            <div key={sig.sym} className={"sigcard rise d" + ((i % 4) + 1)} style={{ display: "flex" }}>
              <div className="sc-accent" style={{ background: accentMap[sig.action] }}/>
              <div style={{ flex: 1 }}>
                <div className="sc-top">
                  <Logo sym={s.sym} color={s.color} size={40}/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}><strong style={{ fontSize: 15 }}>{s.sym}</strong><Signal action={sig.action}/></div>
                    <div className="nm" style={{ fontSize: 12, color: "var(--d-fg-3)" }}>{s.name} · {s.sector}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontWeight: 700, fontSize: 15 }}>{fmtMoney(s.price, s.cur)}</div>
                    <Delta pct={s.changePct} size={11}/>
                  </div>
                </div>
                <div className="sc-body">
                  <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                    <span className="timing"><Ic.clock/> {sig.timing}</span>
                    <span className="tag"><Ic.clock style={{ width: 13, height: 13 }}/> {sig.horizon}</span>
                  </div>
                  <p className="sc-rzn" style={{ margin: "0 0 14px" }}>{sig.reason[risk]}</p>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
                    {sig.drivers.map(d => <span key={d} className="tag" style={{ fontWeight: 600, color: "var(--d-fg-3)" }}>{d}</span>)}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 4 }}>
                    <Lvl label="Confidence" node={<Conf v={sig.conf}/>} />
                    <Lvl label={sig.action === "sell" ? "Downside" : "Target"} val={fmtMoney(lv.target, s.cur)} col={lv.dir === "down" ? "var(--down)" : "var(--up)"} />
                    <Lvl label="Risk level" val={fmtMoney(lv.stop, s.cur)} col="var(--d-fg-2)" />
                  </div>
                </div>
                <div className="sc-foot">
                  <button className="btn btn-ghost btn-sm" onClick={() => onOpen(s.sym)}><Ic.eye/> Open {s.sym}</button>
                  {sig.action !== "sell" && <button className="btn btn-pri btn-sm"><Ic.plus/> Set buy alert</button>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
function Lvl({ label, val, node, col }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--d-fg-3)", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {node || <div className="mono" style={{ fontWeight: 700, fontSize: 14, color: col }}>{val}</div>}
    </div>
  );
}

/* ============================== MARKETS ============================== */
function MarketsView({ onOpen }) {
  useTick();
  const all = AD.list();
  const sectorDefs = [
    { k: "AI", label: "Artificial intelligence", I: Ic.spark2 },
    { k: "Quantum", label: "Quantum computing", I: Ic.atom },
    { k: "Computing", label: "Computing & semis", I: Ic.cpu },
    { k: "Broad", label: "Broad market (SA)", I: Ic.globe },
  ];
  const sectorStat = sectorDefs.map(d => {
    const items = all.filter(s => s.sector === d.k || (d.k === "Broad" && s.sector === "SA"));
    const avg = items.reduce((a, s) => a + s.changePct, 0) / (items.length || 1);
    return { ...d, avg, items };
  });
  const movers = all.slice().sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct)).slice(0, 6);
  const heatBg = (v) => v >= 0
    ? `linear-gradient(135deg, rgba(45,213,151,${Math.min(0.22, 0.05 + Math.abs(v) * 0.05)}), rgba(45,213,151,0.02))`
    : `linear-gradient(135deg, rgba(255,84,112,${Math.min(0.22, 0.05 + Math.abs(v) * 0.05)}), rgba(255,84,112,0.02))`;

  return (
    <div>
      <div className="page-head"><div><h1>Market pulse</h1><p className="sub">Live read on the sectors you invest in</p></div></div>

      {/* sector heat */}
      <div className="grid g-4 rise" style={{ marginBottom: 22 }}>
        {sectorStat.map(d => (
          <div key={d.k} className="heat" style={{ background: heatBg(d.avg) }} onClick={() => {}}>
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <d.I style={{ width: 18, height: 18, color: d.avg >= 0 ? "var(--up)" : "var(--down)" }}/>
              <span className="hs">{d.k === "Broad" ? "Broad / SA" : d.k}</span>
            </div>
            <div className="hp" style={{ color: d.avg >= 0 ? "var(--up)" : "var(--down)" }}>{fmtPct(d.avg)}</div>
            <div className="hn">{d.label} · {d.items.length} names</div>
          </div>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
        {/* all by sector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sectorStat.map(d => (
            <div className="card rise" key={d.k} style={{ padding: 0 }}>
              <div className="card-hd" style={{ padding: "18px 20px 0" }}>
                <d.I style={{ width: 16, height: 16, color: "var(--accent)" }}/>
                <h3>{d.k === "Broad" ? "Broad / South Africa" : d.k}</h3>
                <div className="hd-right"><Delta pct={d.avg}/></div>
              </div>
              <div style={{ padding: "8px 10px 10px" }}>
                <table className="tbl">
                  <tbody>
                    {d.items.map(s => (
                      <tr key={s.sym} onClick={() => onOpen(s.sym)}>
                        <td style={{ width: "44%" }}><div className="tkr"><Logo sym={s.sym} color={s.color} size={30}/><div><div className="sy" style={{ fontSize: 13 }}>{s.sym}</div></div></div></td>
                        <td><Spark data={s.intraday.slice(-30)} w={90} h={26} up={s.changePct >= 0}/></td>
                        <td className="mono" style={{ fontWeight: 600 }}>{fmtMoney(s.price, s.cur)}</td>
                        <td><Delta pct={s.changePct}/></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
        {/* top movers */}
        <div>
          <div className="card rise" style={{ position: "sticky", top: 0 }}>
            <div className="card-hd"><Ic.pulse style={{ width: 16, height: 16, color: "var(--accent)" }}/><h3>Biggest movers</h3></div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {movers.map((s, i) => (
                <div key={s.sym} onClick={() => onOpen(s.sym)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: i < movers.length - 1 ? "1px solid var(--d-line)" : "none", cursor: "pointer" }}>
                  <span className="mono" style={{ color: "var(--d-fg-3)", fontSize: 12, width: 16 }}>{i + 1}</span>
                  <Logo sym={s.sym} color={s.color} size={32}/>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="sy" style={{ fontSize: 13 }}>{s.sym}</div><div className="nm" style={{ fontSize: 11, color: "var(--d-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div></div>
                  <Delta pct={s.changePct}/>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================== STOCK DETAIL ============================== */
function DetailView({ sym, onBack, risk }) {
  useTick();
  const s = AD.get(sym);
  const [range, setRange] = useState("1M");
  const ranges = { "1D": s.intraday, "1W": s.history.slice(-7), "1M": s.history.slice(-30), "3M": s.history };
  const data = range === "1D" ? [...s.intraday] : ranges[range];
  const sig = AD.SIGNALS.find(x => x.sym === sym);
  const news = AD.newsFor(sym);

  const aiText = sig
    ? sig.reason[risk]
    : `${s.name} is trading in line with the ${s.sector} sector. No high-conviction signal right now — keep it on the watchlist and revisit if it breaks out of its recent range. Tuned to a ${RISK[risk].label.toLowerCase()} stance, there's no action to take today.`;
  const typed = useTypewriter(aiText, 9);

  const stats = [
    ["Open", fmtMoney(s.open, s.cur)],
    ["Day high", fmtMoney(s.dayHigh, s.cur)],
    ["Day low", fmtMoney(s.dayLow, s.cur)],
    ["Prev close", fmtMoney(s.prevClose, s.cur)],
    ["Currency", s.cur === "ZAR" ? "ZAR · JSE" : "USD · US"],
    ["Sector", s.sector === "SA" ? "South Africa" : s.sector],
  ];

  return (
    <div>
      <span className="back" onClick={onBack}><Ic.back/> Back</span>
      <div className="page-head" style={{ alignItems: "center" }}>
        <Logo sym={s.sym} color={s.color} size={52}/>
        <div>
          <h1 style={{ display: "flex", alignItems: "center", gap: 10 }}>{s.sym}
            <span className={"cur-tag " + (s.cur === "ZAR" ? "cur-zar" : "cur-usd")} style={{ fontSize: 11 }}>{s.cur}</span>
            {sig && <Signal action={sig.action}/>}
          </h1>
          <p className="sub">{s.name} · {s.sector === "SA" ? "South Africa" : s.sector}</p>
        </div>
        <div className="ph-right" style={{ alignItems: "flex-end", flexDirection: "column", gap: 4 }}>
          <div className="mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "-0.02em" }}><PriceCell s={s}/></div>
          <Delta pct={s.changePct} abs={s.change} cur={s.cur}/>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* chart */}
          <div className="card pad-lg rise">
            <div className="card-hd">
              <span className="ey">Price</span>
              <div className="hd-right"><div className="chart-tabs">{Object.keys(ranges).map(r => (
                <button key={r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>{r}</button>
              ))}</div></div>
            </div>
            <AreaChart key={range} data={data} cur={s.cur} height={300} />
          </div>
          {/* key stats */}
          <div className="card rise d1">
            <div className="card-hd"><span className="ey">Key stats</span></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "18px 24px" }}>
              {stats.map(([k, v]) => (
                <div key={k}><div style={{ fontSize: 11, color: "var(--d-fg-3)", fontWeight: 600, marginBottom: 4 }}>{k}</div><div className="mono" style={{ fontWeight: 600, fontSize: 15 }}>{v}</div></div>
              ))}
            </div>
          </div>
          {/* news */}
          <div className="card rise d2">
            <div className="card-hd"><Ic.news style={{ width: 16, height: 16, color: "var(--accent)" }}/><h3>News & sentiment</h3></div>
            {news.map((n, i) => (
              <div className="news" key={i}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="nsrc">{n.src}</span><span className="nsrc">· {n.time} ago</span></div>
                  <div className="nti">{n.title}</div>
                  <span className={"senti " + n.sent}>{n.sent === "pos" ? "Bullish" : n.sent === "neg" ? "Bearish" : "Neutral"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* right rail */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div className="aibox rise">
            <div className="ai-hd">
              <span className="ai-mark"><Ic.spark2 style={{ width: 15, height: 15 }}/></span>
              <strong style={{ fontSize: 14 }}>AI take</strong>
              <span className="tag" style={{ marginLeft: "auto", fontSize: 10 }}>{RISK[risk].label}</span>
            </div>
            <p className={"sc-rzn " + (typed.length < aiText.length ? "typing" : "")} style={{ margin: 0, minHeight: 80 }}>{typed}</p>
            {sig && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--d-line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}><Ic.clock style={{ width: 15, height: 15, color: "var(--accent)" }}/><strong style={{ fontSize: 13 }}>{sig.timing}</strong></div>
                <Conf v={sig.conf}/>
              </div>
            )}
            {/* live Claude analysis, on demand (web-aware) */}
            <LiveAITake sym={sym} risk={risk}/>
          </div>
          <div className="card rise d1">
            <div className="card-hd"><Ic.target style={{ width: 16, height: 16, color: "var(--accent)" }}/><h3>Your position</h3></div>
            {(() => {
              const h = AD.HOLDINGS.find(x => x.sym === sym);
              if (!h) return <div className="empty" style={{ padding: "16px 0" }}>You don't own {sym} yet.<div style={{ marginTop: 12 }}><button className="btn btn-pri btn-sm"><Ic.plus/> Buy {sym}</button></div></div>;
              const val = h.shares * s.price, cost = h.shares * h.avg, pl = val - cost;
              return (<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 12px" }}>
                <Lvl label="Shares" val={h.shares}/>
                <Lvl label="Avg cost" val={fmtMoney(h.avg, s.cur)}/>
                <Lvl label="Market value" val={fmtMoney(val, s.cur)}/>
                <Lvl label="Unrealised P&L" val={fmtSignCur(pl, s.cur)} col={pl >= 0 ? "var(--up)" : "var(--down)"}/>
              </div>);
            })()}
          </div>
          <button className="btn btn-pri" style={{ justifyContent: "center", padding: "13px" }}><Ic.plus/> Trade on EasyEquities</button>
        </div>
      </div>
    </div>
  );
}

window.SignalsView = SignalsView;
window.MarketsView = MarketsView;
window.DetailView = DetailView;
