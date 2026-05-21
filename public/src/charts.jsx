// ============================================================
// Charts — radar, heatmap, sparkline, trend
// ============================================================

function HealthRadar({ dimensions, size = 280, stroke = 1.4 }) {
  const cx = size / 2;
  const cy = size / 2;
  const r  = size / 2 - 30;
  const n  = dimensions.length;
  const angle = (i) => (-Math.PI / 2) + (i * 2 * Math.PI) / n;

  const polyPoints = dimensions.map((d, i) => {
    const a = angle(i);
    const rr = (d.score / 100) * r;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  const pathFill = polyPoints.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + " Z";

  // ring grid
  const rings = [0.25, 0.5, 0.75, 1].map((t, idx) => {
    const pts = dimensions.map((_, i) => {
      const a = angle(i);
      return [cx + Math.cos(a) * r * t, cy + Math.sin(a) * r * t];
    });
    return pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + " Z";
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
      {/* threshold band 50 */}
      <circle cx={cx} cy={cy} r={r * 0.5} fill="var(--warn-bg)" stroke="none" />
      <circle cx={cx} cy={cy} r={r * 0.25} fill="var(--crit-bg)" stroke="none" />
      {rings.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 3 ? "" : "2 3"} />
      ))}
      {/* spokes */}
      {dimensions.map((d, i) => {
        const a = angle(i);
        const x2 = cx + Math.cos(a) * r;
        const y2 = cy + Math.sin(a) * r;
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--line)" strokeWidth="1" />;
      })}
      {/* fill */}
      <path d={pathFill} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth={stroke} strokeLinejoin="round" />
      {polyPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="3.2" fill="var(--accent)" stroke="var(--bg-elev)" strokeWidth="1.5" />
      ))}
      {/* labels */}
      {dimensions.map((d, i) => {
        const a = angle(i);
        const lx = cx + Math.cos(a) * (r + 18);
        const ly = cy + Math.sin(a) * (r + 18);
        return (
          <g key={i}>
            <text x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 10.5, fill: "var(--ink-2)", fontFamily: "var(--mono)", letterSpacing: 0.5 }}>{d.label.toUpperCase()}</text>
            <text x={lx} y={ly + 12} textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 11, fill: "var(--ink)", fontFamily: "var(--mono)", fontWeight: 600 }}>{d.score}</text>
          </g>
        );
      })}
      {/* center label */}
      <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 9, fill: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 1.4 }}>SCORE</text>
      <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 22, fill: "var(--ink)", fontFamily: "var(--mono)", fontWeight: 600 }}>
        {Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length)}
      </text>
    </svg>
  );
}

// Site Health Bars — one row per operator, stacked horizontal bar of
// engines by condition (Normal / Caution / Critical / Severe), plus
// the 2 worst engines as quick-jump chips. Far easier to scan than the
// previous cell-grid heatmap.
function FleetHeatmap({ sites, assets, onPick }) {
  return (
    <div className="hb-wrap">
      <div className="hb-head mono">
        <span>OPERATOR</span>
        <span style={{ textAlign: "right" }}>ENGINES</span>
        <span>CONDITION MIX</span>
        <span>WORST</span>
      </div>
      {sites.map(s => {
        const list = assets.filter(a => a.site === s.id);
        const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
        for (const a of list) counts[a.code]++;
        const total = list.length;
        const worst = list.slice().sort((a, b) => a.health - b.health).slice(0, 2);
        if (total === 0) return (
          <div key={s.id} className="hb-row">
            <div className="hb-site">
              <div className="hb-site-name">{s.name}</div>
              <div className="hb-site-region mono">{s.code} · {s.region}</div>
            </div>
            <div className="hb-total mono">0</div>
            <div className="hb-bar hb-bar-empty">no engines in this scope</div>
            <div></div>
          </div>
        );
        return (
          <div key={s.id} className="hb-row">
            <div className="hb-site">
              <div className="hb-site-name">{s.name}</div>
              <div className="hb-site-region mono">{s.code} · {s.region}</div>
            </div>
            <div className="hb-total mono">{total}</div>
            <div className="hb-bar" title={`Normal ${counts[1]} · Caution ${counts[2]} · Critical ${counts[3]} · Severe ${counts[4]}`}>
              {[1,2,3,4].map(c => counts[c] > 0 && (
                <span key={c} className={`hb-seg hb-c-${c}`} style={{ flex: counts[c] }}>
                  {counts[c] / total > 0.10 ? `${counts[c]} ${window.COND[c].short}` : ""}
                </span>
              ))}
            </div>
            <div className="hb-worst">
              {worst.map(a => (
                <button key={a.id} className={`hb-chip hb-c-${a.code}`} onClick={() => onPick && onPick(a)}
                        title={`${a.name} · ${a.tag} · score ${a.health}`}>
                  <span className="mono" style={{ fontWeight: 600 }}>{a.health}</span>
                  <span className="hb-chip-name">{a.name.split(" · ")[0]}</span>
                </button>
              ))}
              {worst.length === 0 && <span className="hb-empty-chip mono">all clear</span>}
            </div>
          </div>
        );
      })}

      <style>{`
        .hb-wrap { padding: 4px 0 8px; }
        .hb-head, .hb-row {
          display: grid; grid-template-columns: 200px 64px 1fr 240px;
          gap: 16px; align-items: center; padding: 10px 18px;
        }
        .hb-head { font-size: 10px; letter-spacing: 0.12em; color: var(--ink-3); text-transform: uppercase; padding-bottom: 6px; padding-top: 6px; }
        .hb-row { border-top: 1px solid var(--line); }
        .hb-row:hover { background: var(--bg-sunken); }
        .hb-site-name { font-size: 13px; color: var(--ink); }
        .hb-site-region { font-size: 10px; color: var(--ink-3); letter-spacing: 0.06em; margin-top: 2px; }
        .hb-total { font-size: 14px; font-weight: 600; text-align: right; color: var(--ink); }
        .hb-bar { display: flex; height: 22px; border-radius: 5px; overflow: hidden; background: var(--bg-sunken); border: 1px solid var(--line); }
        .hb-bar-empty { display: grid; place-items: center; font-size: 11px; color: var(--ink-3); font-family: var(--mono); letter-spacing: 0.04em; }
        .hb-seg { display: grid; place-items: center; font-size: 10.5px; font-weight: 500; letter-spacing: 0.04em; font-family: var(--mono); overflow: hidden; white-space: nowrap; }
        .hb-c-1 { background: var(--ok);   color: #fff; }
        .hb-c-2 { background: var(--warn); color: #fff; }
        .hb-c-3 { background: var(--crit); color: #fff; }
        .hb-c-4 { background: var(--sev);  color: #fff; }
        .hb-worst { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }
        .hb-chip {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 4px 8px 4px 6px; border-radius: 6px;
          font-size: 11.5px; max-width: 160px;
        }
        .hb-chip-name { color: #fff; opacity: 0.95; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hb-chip.hb-c-1 .hb-chip-name { color: var(--ok); }
        .hb-chip.hb-c-1 { background: var(--ok-bg);   color: var(--ok); }
        .hb-chip.hb-c-2 { background: var(--warn-bg); color: var(--warn); }
        .hb-chip.hb-c-3 { background: var(--crit-bg); color: var(--crit); }
        .hb-chip.hb-c-4 { background: var(--sev-bg);  color: var(--ink); }
        .hb-chip.hb-c-2 .hb-chip-name { color: var(--warn); }
        .hb-chip.hb-c-3 .hb-chip-name { color: var(--crit); }
        .hb-chip.hb-c-4 .hb-chip-name { color: var(--ink); }
        .hb-empty-chip { font-size: 10.5px; color: var(--ink-3); letter-spacing: 0.06em; }
      `}</style>
    </div>
  );
}

function Sparkline({ data, w = 80, h = 24, accent = "var(--accent)" }) {
  if (!data || !data.length) return null;
  const max = Math.max(...data), min = Math.min(...data);
  const span = max - min || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, h - ((v - min) / span) * (h - 4) - 2]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <path d={d} fill="none" stroke={accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r="2" fill={accent} />
    </svg>
  );
}

function TrendChart({ trend, height = 260, label = "Iron (Fe)", color = "var(--accent)" }) {
  if (!trend || !trend.points || trend.points.length === 0) {
    return (
      <div style={{ height, display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 12, fontFamily: "var(--mono)", letterSpacing: 0.06 }}>
        NOT ENOUGH SAMPLES TO PLOT TREND
      </div>
    );
  }
  const W = 760, H = height;
  const padL = 44, padR = 16, padT = 16, padB = 36;
  const pts = trend.points;
  const vals = pts.map(p => p.value);
  const alarmTop = typeof trend.alarm === "number" ? trend.alarm * 1.1 : Math.max(...vals) * 1.2;
  const max = Math.max(alarmTop, ...vals, typeof trend.warn === "number" ? trend.warn : 0) || 1;
  const min = 0;
  const xAt = (i) => padL + (pts.length > 1 ? (i / (pts.length - 1)) : 0.5) * (W - padL - padR);
  const yAt = (v) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);

  const linePath = pts.map((p, i) => (i === 0 ? "M" : "L") + xAt(i).toFixed(1) + " " + yAt(p.value).toFixed(1)).join(" ");
  const areaPath = linePath + ` L ${xAt(pts.length - 1)} ${H - padB} L ${xAt(0)} ${H - padB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* alarm band */}
      {typeof trend.alarm === "number" && <rect x={padL} y={yAt(trend.alarm)} width={W - padL - padR} height={H - padB - yAt(trend.alarm)} fill="var(--crit-bg)" />}
      {typeof trend.warn === "number" && typeof trend.alarm === "number" && <rect x={padL} y={yAt(trend.warn)} width={W - padL - padR} height={yAt(trend.alarm) - yAt(trend.warn)} fill="var(--warn-bg)" />}
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padT + t * (H - padT - padB);
        const v = max - t * (max - min);
        return (<g key={t}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="0.6" />
          <text x={padL - 6} y={y + 3} textAnchor="end" style={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--mono)" }}>{Math.round(v)}</text>
        </g>);
      })}
      {/* limit lines */}
      {typeof trend.warn === "number" && <>
        <line x1={padL} y1={yAt(trend.warn)} x2={W - padR} y2={yAt(trend.warn)} stroke="var(--warn)" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - padR - 4} y={yAt(trend.warn) - 4}  textAnchor="end" style={{ fontSize: 10, fill: "var(--warn)", fontFamily: "var(--mono)" }}>WARN {trend.warn}</text>
      </>}
      {typeof trend.alarm === "number" && <>
        <line x1={padL} y1={yAt(trend.alarm)} x2={W - padR} y2={yAt(trend.alarm)} stroke="var(--crit)" strokeWidth="1" strokeDasharray="4 3" />
        <text x={W - padR - 4} y={yAt(trend.alarm) - 4} textAnchor="end" style={{ fontSize: 10, fill: "var(--crit)", fontFamily: "var(--mono)" }}>ALARM {trend.alarm}</text>
      </>}
      {/* line + area */}
      <path d={areaPath} fill="url(#trendArea)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={xAt(i)} cy={yAt(p.value)} r="3" fill="var(--bg-elev)" stroke={color} strokeWidth="1.6" />
        </g>
      ))}
      {/* x-axis labels */}
      {pts.map((p, i) => i % 2 === 0 ? (
        <text key={i} x={xAt(i)} y={H - padB + 16} textAnchor="middle" style={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--mono)" }}>{window.fmtShortDate(p.date)}</text>
      ) : null)}
    </svg>
  );
}

function RULBar({ days, total = 120 }) {
  const pct = Math.min(100, Math.max(2, (days / total) * 100));
  const color = days < 30 ? "var(--crit)" : days < 60 ? "var(--warn)" : "var(--ok)";
  return (
    <div className="rul-bar">
      <div className="rul-track">
        <div className="rul-fill" style={{ width: pct + "%", background: color }} />
      </div>
      <div className="rul-meta mono">
        <span style={{ color }}>{days} d</span>
        <span className="muted">to condemn</span>
      </div>
    </div>
  );
}

// Condition donut — five-segment SVG ring used on the dashboard. Each
// slice is { code, label, n, color } and renders proportional to n.
// Empty input shows a neutral ring with "no data" centre text.
function ConditionDonut({ slices, size = 200, thickness = 28 }) {
  const total = slices.reduce((a, s) => a + (s.n || 0), 0);
  const cx = size / 2, cy = size / 2;
  const r = size / 2 - thickness / 2 - 2;
  const C = 2 * Math.PI * r;
  // Render slices as overlapping circles using stroke-dasharray, so we
  // don't have to compute arc paths. Each segment starts where the
  // previous one ended.
  let offset = 0;
  const segs = total > 0 ? slices.filter(s => s.n > 0).map(s => {
    const len = (s.n / total) * C;
    const node = { ...s, len, offset };
    offset += len;
    return node;
  }) : [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: `${size}px 1fr`, gap: 18, alignItems: "center" }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-sunken)" strokeWidth={thickness} />
        {segs.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                  stroke={s.color} strokeWidth={thickness}
                  strokeDasharray={`${s.len.toFixed(2)} ${(C - s.len).toFixed(2)}`}
                  strokeDashoffset={(-s.offset).toFixed(2)}
                  style={{ transition: "stroke-dasharray 200ms" }} />
        ))}
        {/* Inner mask: counter-rotate the centre text so it stays upright. */}
        <g style={{ transform: "rotate(90deg)", transformOrigin: `${cx}px ${cy}px` }}>
          <text x={cx} y={cy - 4} textAnchor="middle" style={{ fontSize: 22, fontWeight: 600, fill: "var(--ink)", fontFamily: "var(--mono)" }}>{total}</text>
          <text x={cx} y={cy + 14} textAnchor="middle" style={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--mono)", letterSpacing: 0.12 }}>COMPONENTS</text>
        </g>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {slices.map((s, i) => {
          const pct = total > 0 ? (s.n / total * 100) : 0;
          return (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "12px 1fr auto auto", gap: 10, alignItems: "center", fontSize: 12 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color, display: "inline-block" }}/>
              <span style={{ color: "var(--ink-2)" }}>{s.label}</span>
              <span className="mono" style={{ color: "var(--ink-3)", fontSize: 11 }}>{pct.toFixed(1)}%</span>
              <span className="mono" style={{ color: "var(--ink)", fontSize: 12, fontWeight: 600, minWidth: 28, textAlign: "right" }}>{s.n}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Horizontal chip strip used to filter the dashboard by asset class
// (component type, in TruVu's language). The "ALL" chip always sits
// first and shows the unfiltered total.
function ComponentTypeChips({ items, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
      <button className={`btn btn-sm ${value === "ALL" ? "btn-primary" : "btn-ghost"}`} onClick={() => onChange("ALL")}>
        ALL COMPONENTS<span className="mono" style={{ marginLeft: 4, opacity: 0.7 }}>({items.reduce((a, b) => a + b.n, 0)})</span>
      </button>
      {items.map(it => (
        <button key={it.id} className={`btn btn-sm ${value === it.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => onChange(it.id)}>
          {(it.label || it.id).toUpperCase()}<span className="mono" style={{ marginLeft: 4, opacity: 0.7 }}>({it.n})</span>
        </button>
      ))}
    </div>
  );
}

window.HealthRadar = HealthRadar;
window.FleetHeatmap = FleetHeatmap;
window.Sparkline = Sparkline;
window.TrendChart = TrendChart;
window.RULBar = RULBar;
window.ConditionDonut = ConditionDonut;
window.ComponentTypeChips = ComponentTypeChips;
