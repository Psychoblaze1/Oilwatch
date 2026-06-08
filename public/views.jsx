/* views.jsx — Atomic Capital screens */
const AD = window.AtomicData;

/* re-render on every live tick */
function useTick() {
  const [, force] = useState(0);
  useEffect(() => AD.subscribe(() => force(n => n + 1)), []);
}

/* risk metadata */
const RISK = {
  cons: { key: "cons", label: "Conservative", blurb: "Capital preservation first — smaller sizes, wider margins of safety." },
  bal:  { key: "bal",  label: "Balanced",     blurb: "A measured mix of growth and protection." },
  agg:  { key: "agg",  label: "Aggressive",   blurb: "Maximise upside — larger positions, higher conviction, more volatility." },
};

/* portfolio math */
function usePortfolio() {
  const rows = AD.HOLDINGS.map(h => {
    const s = AD.get(h.sym);
    const value = h.shares * s.price;
    const cost = h.shares * h.avg;
    const valZar = h.acct === "USD" ? value * AD.USDZAR : value;
    const costZar = h.acct === "USD" ? cost * AD.USDZAR : cost;
    const dayZar = (h.acct === "USD" ? (s.change * h.shares) * AD.USDZAR : s.change * h.shares);
    return { ...h, s, value, cost, valZar, costZar, plZar: valZar - costZar, plPct: ((value - cost) / cost) * 100, dayZar };
  });
  const totalZar = rows.reduce((a, r) => a + r.valZar, 0);
  const costZar = rows.reduce((a, r) => a + r.costZar, 0);
  const dayZar = rows.reduce((a, r) => a + r.dayZar, 0);
  const buying = 24850; // ZAR available
  return { rows, totalZar, costZar, dayZar, plZar: totalZar - costZar, plPct: ((totalZar - costZar) / costZar) * 100, buying };
}

/* synthetic portfolio history in ZAR */
function portfolioHistory() {
  const n = 90;
  const out = new Array(n).fill(0);
  AD.HOLDINGS.forEach(h => {
    const s = AD.get(h.sym);
    const fx = h.acct === "USD" ? AD.USDZAR : 1;
    for (let i = 0; i < n; i++) out[i] += (s.history[i] || s.history[0]) * h.shares * fx;
  });
  return out;
}

/* price cell with flash on change */
function PriceCell({ s }) {
  const ref = useRef(null);
  const prev = useRef(s.price);
  useEffect(() => {
    if (s.price !== prev.current && ref.current) {
      const up = s.price > prev.current;
      ref.current.classList.remove("flash-up", "flash-down");
      void ref.current.offsetWidth;
      ref.current.classList.add(up ? "flash-up" : "flash-down");
      prev.current = s.price;
    }
  });
  return <span ref={ref} className="mono" style={{ borderRadius: 6, padding: "2px 5px", fontWeight: 600 }}>{fmtMoney(s.price, s.cur)}</span>;
}

/* ============================== PORTFOLIO ============================== */
function PortfolioView({ onOpen, risk }) {
  useTick();
  const p = usePortfolio();
  const hist = useMemo(portfolioHistory, [p.totalZar > 0]);
  const liveHist = [...hist.slice(0, -1), p.totalZar];
  const dayUp = p.dayZar >= 0;

  // sector allocation
  const sectors = {};
  p.rows.forEach(r => { sectors[r.s.sector] = (sectors[r.s.sector] || 0) + r.valZar; });
  const secColors = { AI: "#3FB6F1", Quantum: "#8C3FCF", Computing: "#1B6FE0", SA: "#E0394B", Broad: "#10A86A" };
  const allocs = Object.entries(sectors).map(([k, v]) => ({ k, v, pct: (v / p.totalZar) * 100 })).sort((a, b) => b.v - a.v);

  // concentration warning
  const top = p.rows.slice().sort((a, b) => b.valZar - a.valZar)[0];
  const topPct = (top.valZar / p.totalZar) * 100;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Portfolio</h1>
          <p className="sub">EasyEquities · USD + ZAR accounts · blended in Rand</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-ghost btn-sm"><Ic.refresh/> Sync</button>
          <button className="btn btn-pri btn-sm"><Ic.plus/> Add funds</button>
        </div>
      </div>

      {/* stat row */}
      <div className="grid g-4 rise" style={{ marginBottom: 18 }}>
        <div className="card stat">
          <div className="lab"><Ic.grid style={{ width: 14, height: 14 }}/> Total value</div>
          <div className="val big">{fmtMoney(p.totalZar, "ZAR", 0)}</div>
          <Delta pct={p.plPct} />
        </div>
        <div className="card stat">
          <div className="lab"><Ic.clock style={{ width: 14, height: 14 }}/> Today</div>
          <div className={"val " + (dayUp ? "num-up" : "num-down")}>{fmtSignCur(p.dayZar, "ZAR")}</div>
          <Delta pct={(p.dayZar / (p.totalZar - p.dayZar)) * 100} />
        </div>
        <div className="card stat">
          <div className="lab"><Ic.up style={{ width: 14, height: 14 }}/> Total return</div>
          <div className={"val " + (p.plZar >= 0 ? "num-up" : "num-down")}>{fmtSignCur(p.plZar, "ZAR")}</div>
          <span className="t-caption" style={{ color: "var(--d-fg-3)" }}>on {fmtMoney(p.costZar, "ZAR", 0)} invested</span>
        </div>
        <div className="card stat">
          <div className="lab"><Ic.shield style={{ width: 14, height: 14 }}/> Buying power</div>
          <div className="val">{fmtMoney(p.buying, "ZAR", 0)}</div>
          <span className="t-caption" style={{ color: "var(--d-fg-3)" }}>available to invest</span>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr", marginBottom: 18 }}>
        {/* perf chart */}
        <div className="card pad-lg rise d1">
          <div className="card-hd">
            <span className="ey">Performance</span>
            <h3 style={{ marginLeft: 4 }}>Last 90 days</h3>
            <div className="hd-right"><Delta pct={((liveHist[liveHist.length-1]-liveHist[0])/liveHist[0])*100}/></div>
          </div>
          <AreaChart data={liveHist} cur="ZAR" height={264} />
        </div>
        {/* allocation */}
        <div className="card pad-lg rise d2">
          <div className="card-hd"><span className="ey">Allocation</span><h3 style={{ marginLeft: 4 }}>By sector</h3></div>
          <div className="alloc">
            {allocs.map(a => <i key={a.k} style={{ width: a.pct + "%", background: secColors[a.k] }} title={a.k}/>)}
          </div>
          <div className="legend">
            {allocs.map(a => (
              <div className="lr" key={a.k}>
                <span className="sw" style={{ background: secColors[a.k] }}/>
                <span style={{ color: "var(--d-fg-2)", fontWeight: 600 }}>{a.k === "SA" ? "South Africa" : a.k}</span>
                <span className="pct">{a.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <hr className="sep" style={{ margin: "18px 0 16px" }}/>
          <div className="aibox" style={{ padding: 16, background: topPct > 35 ? "rgba(232,163,23,0.08)" : undefined, borderColor: topPct > 35 ? "rgba(232,163,23,0.3)" : undefined }}>
            <div className="ai-hd" style={{ marginBottom: 8 }}>
              <span className="ai-mark" style={{ background: topPct > 35 ? "var(--hold)" : undefined }}>{topPct > 35 ? <Ic.alert/> : <Ic.shield/>}</span>
              <strong style={{ fontSize: 13 }}>{topPct > 35 ? "Concentration risk" : "Balance check"}</strong>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--d-fg-2)", lineHeight: 1.55 }}>
              {top.sym} is {topPct.toFixed(0)}% of your book. {topPct > 35
                ? (risk === "agg" ? "Heavy, but in line with an aggressive stance — just know a single name drives your returns." : "Consider trimming into strength to reduce single-name risk.")
                : "Spread looks healthy across AI, quantum and computing."}
            </p>
          </div>
        </div>
      </div>

      {/* holdings table */}
      <div className="card rise d3" style={{ padding: 0 }}>
        <div className="card-hd" style={{ padding: "20px 22px 0" }}>
          <span className="ey">Holdings</span><h3 style={{ marginLeft: 4 }}>{p.rows.length} positions</h3>
          <div className="hd-right t-caption" style={{ color: "var(--d-fg-3)", display: "flex", alignItems: "center", gap: 6 }}>
            <span className="mkt-chip"><span className="dot open"/></span> live
          </div>
        </div>
        <div style={{ padding: "12px 10px 8px" }}>
          <table className="tbl">
            <thead><tr>
              <th>Position</th><th>Price</th><th>Today</th><th>Shares</th><th>Market value</th><th>Total P&L</th><th></th>
            </tr></thead>
            <tbody>
              {p.rows.map(r => (
                <tr key={r.sym} onClick={() => onOpen(r.sym)}>
                  <td><div className="tkr">
                    <Logo sym={r.sym} color={r.s.color}/>
                    <div><div className="sy">{r.sym} <span className={"cur-tag " + (r.acct === "ZAR" ? "cur-zar" : "cur-usd")}>{r.acct}</span></div><div className="nm">{r.s.name}</div></div>
                  </div></td>
                  <td><PriceCell s={r.s}/></td>
                  <td><Delta pct={r.s.changePct}/></td>
                  <td className="mono" style={{ color: "var(--d-fg-2)" }}>{r.shares}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{fmtMoney(r.value, r.s.cur)}</td>
                  <td>
                    <div className="mono" style={{ fontWeight: 600, color: r.plZar >= 0 ? "var(--up)" : "var(--down)" }}>{fmtSignCur(r.plZar, "ZAR")}</div>
                    <div className="mono" style={{ fontSize: 11, color: r.plPct >= 0 ? "var(--up)" : "var(--down)" }}>{fmtPct(r.plPct)}</div>
                  </td>
                  <td><Ic.arrow style={{ width: 16, height: 16, color: "var(--d-fg-3)" }}/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============================== WATCHLIST ============================== */
function WatchView({ onOpen }) {
  useTick();
  const [filter, setFilter] = useState("All");
  const sigBy = {}; AD.SIGNALS.forEach(s => sigBy[s.sym] = s.action);
  const items = AD.WATCH.map(AD.get);
  const sectors = ["All", "AI", "Quantum", "Computing"];
  const shown = items.filter(s => filter === "All" || s.sector === filter);

  return (
    <div>
      <div className="page-head">
        <div><h1>Watchlist</h1><p className="sub">Names you're tracking across AI, quantum and computing</p></div>
        <div className="ph-right"><button className="btn btn-ghost btn-sm"><Ic.plus/> Add ticker</button></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {sectors.map(sec => (
          <button key={sec} className={"btn btn-sm " + (filter === sec ? "btn-pri" : "btn-ghost")} onClick={() => setFilter(sec)}>{sec}</button>
        ))}
      </div>
      <div className="grid g-4">
        {shown.map((s, i) => (
          <div key={s.sym} className={"wcard rise d" + ((i % 5) + 1)} onClick={() => onOpen(s.sym)}>
            <div className="wc-top">
              <Logo sym={s.sym} color={s.color}/>
              <div style={{ minWidth: 0 }}><div className="sy" style={{ fontWeight: 700 }}>{s.sym}</div><div className="nm" style={{ fontSize: 12, color: "var(--d-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div></div>
              {sigBy[s.sym] && <span style={{ marginLeft: "auto" }}><Signal action={sigBy[s.sym]}/></span>}
            </div>
            <Spark data={s.intraday.slice(-40)} w={210} h={48} up={s.changePct >= 0}/>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{fmtMoney(s.price, s.cur)}</div>
              <Delta pct={s.changePct}/>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.PortfolioView = PortfolioView;
window.WatchView = WatchView;
window.RISK = RISK;
window.useTick = useTick;
window.usePortfolio = usePortfolio;
