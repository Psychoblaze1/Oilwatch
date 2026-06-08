/* components.jsx — Atomic Capital shared UI */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

/* ---------------- formatters ---------------- */
const fmtMoney = (v, cur, dp = 2) => {
  const sym = cur === "ZAR" ? "R" : "$";
  return sym + Number(v).toLocaleString("en-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
};
const fmtNum = (v, dp = 2) => Number(v).toLocaleString("en-ZA", { minimumFractionDigits: dp, maximumFractionDigits: dp });
const fmtPct = (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%";
const fmtSign = (v) => (v >= 0 ? "+" : "−") + fmtNum(Math.abs(v));
const fmtSignCur = (v, cur) => (v >= 0 ? "+" : "−") + fmtMoney(Math.abs(v), cur);

/* ---------------- icons (lucide-style) ---------------- */
const Ic = {
  grid:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>,
  eye:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  spark:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5L13 3z"/></svg>,
  pulse:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>,
  search: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  bell:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>,
  up:     (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 17L17 7M9 7h8v8"/></svg>,
  down:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M7 7l10 10M15 17H7V9"/></svg>,
  arrow:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  back:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M19 12H5M11 19l-7-7 7-7"/></svg>,
  clock:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  plus:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 5v14M5 12h14"/></svg>,
  check:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20 6L9 17l-5-5"/></svg>,
  x:      (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  pause:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M6 4v16M18 4v16"/></svg>,
  spark2: (p) => <svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l2.4 6.4L21 11l-6.6 2.6L12 20l-2.4-6.4L3 11l6.6-2.6L12 2z"/></svg>,
  alert:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>,
  shield: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  target: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>,
  news:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 4h13a2 2 0 0 1 2 2v12a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2V4z"/><path d="M8 8h7M8 12h7M8 16h4"/></svg>,
  cpu:    (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></svg>,
  atom:   (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="1.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="10" ry="4.5"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(120 12 12)"/></svg>,
  globe:  (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>,
  sliders:(p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>,
  refresh:(p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>,
};

/* ---------------- ticker logo ---------------- */
function Logo({ sym, color, size = 36 }) {
  const txt = sym.length > 4 ? sym.slice(0, 3) : sym.slice(0, 2);
  return (
    <div className="logo" style={{ width: size, height: size, background: color, fontSize: size * 0.34,
      borderRadius: size * 0.25, color: pickFg(color) }}>{txt}</div>
  );
}
function pickFg(hex) {
  const c = hex.replace("#", ""); const r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
  return (r*299 + g*587 + b*114) / 1000 > 150 ? "#0A0B1A" : "#fff";
}

/* ---------------- delta pill ---------------- */
function Delta({ pct, abs, cur, size }) {
  const up = pct >= 0;
  return (
    <span className={`delta ${up ? "up" : "down"}`} style={size ? { fontSize: size } : undefined}>
      {up ? <Ic.up/> : <Ic.down/>}
      {abs != null ? fmtSign(abs) + " " : ""}{fmtPct(pct)}
    </span>
  );
}

/* ---------------- signal chip ---------------- */
function Signal({ action }) {
  const map = { buy: ["buy", Ic.up, "Buy"], sell: ["sell", Ic.down, "Sell"], hold: ["hold", Ic.pause, "Hold"], watch: ["watch", Ic.eye, "Watch"] };
  const [cls, I, label] = map[action] || map.watch;
  return <span className={`sig ${cls}`}><I/>{label}</span>;
}

/* ---------------- confidence meter ---------------- */
function Conf({ v }) {
  return (
    <div className="conf">
      <div className="conf-bar"><i style={{ width: Math.round(v * 100) + "%" }}/></div>
      <span className="conf-val">{Math.round(v * 100)}%</span>
    </div>
  );
}

/* ---------------- sparkline ---------------- */
function Spark({ data, w = 108, h = 34, up }) {
  const { d, area } = useMemo(() => {
    if (!data || data.length < 2) return { d: "", area: "" };
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => [i * step, h - ((v - min) / span) * (h - 4) - 2]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = d + ` L${w} ${h} L0 ${h} Z`;
    return { d, area };
  }, [data, w, h]);
  const col = up ? "var(--up)" : "var(--down)";
  const id = "sg" + Math.abs(hashStr(d)).toString(36).slice(0, 6);
  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={col} stopOpacity="0.22"/><stop offset="1" stopColor={col} stopOpacity="0"/>
      </linearGradient></defs>
      <path d={area} fill={`url(#${id})`}/>
      <path d={d} fill="none" stroke={col} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0; return h; }

/* ---------------- big interactive area chart ---------------- */
function AreaChart({ data, cur, height = 300, accent, fill = (window.AC_FILL || "gradient") }) {
  const wrapRef = useRef(null);
  const [w, setW] = useState(760);
  const [hover, setHover] = useState(null);
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver(es => setW(es[0].contentRect.width));
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);
  const pad = { t: 16, r: 8, b: 22, l: 8 };
  const W = w, H = height;
  const up = data[data.length - 1] >= data[0];
  const col = accent || (up ? "var(--up)" : "var(--down)");
  const { d, area, pts, min, max } = useMemo(() => {
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const step = iw / (data.length - 1);
    const pts = data.map((v, i) => [pad.l + i * step, pad.t + ih - ((v - min) / span) * ih]);
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const area = d + ` L${pad.l + iw} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z`;
    return { d, area, pts, min, max };
  }, [data, W, H]);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(((x - pad.l) / (W - pad.l - pad.r)) * (data.length - 1))));
    setHover({ idx, x: pts[idx][0], y: pts[idx][1] });
  };
  return (
    <div className="chart-wrap" ref={wrapRef} style={{ height: H }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id="bigfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={col} stopOpacity={fill === "gradient" ? 0.30 : 0.14}/>
            <stop offset="1" stopColor={col} stopOpacity="0"/>
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(g => (
          <line key={g} x1={pad.l} x2={W - pad.r} y1={pad.t + (H - pad.t - pad.b) * g} y2={pad.t + (H - pad.t - pad.b) * g} stroke="rgba(255,255,255,0.05)"/>
        ))}
        {fill !== "line" && <path d={area} fill="url(#bigfill)"/>}
        <path d={d} fill="none" stroke={col} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        {hover && (<>
          <line x1={hover.x} x2={hover.x} y1={pad.t} y2={H - pad.b} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3"/>
          <circle cx={hover.x} cy={hover.y} r="4.5" fill={col} stroke="#0A0B1A" strokeWidth="2"/>
        </>)}
      </svg>
      {hover && (
        <div className="ctip" style={{ left: Math.max(40, Math.min(W - 40, hover.x)), top: hover.y }}>
          <div className="ct-p">{fmtMoney(data[hover.idx], cur)}</div>
          <div className="ct-d">{hover.idx} pts ago</div>
        </div>
      )}
    </div>
  );
}

Object.assign(window, {
  fmtMoney, fmtNum, fmtPct, fmtSign, fmtSignCur, Ic, Logo, Delta, Signal, Conf, Spark, AreaChart,
});
