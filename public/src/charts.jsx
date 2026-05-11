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

function FleetHeatmap({ sites, assets, onPick }) {
  const cls = window.ASSET_CLASSES;
  // build matrix: rows=site, cols=class, cell = list of assets
  const matrix = sites.map(s => cls.map(c => assets.filter(a => a.site === s.id && a.class === c.id)));
  return (
    <div className="heatmap">
      <div className="heatmap-head">
        <div></div>
        {cls.map(c => (<div key={c.id} className="heatmap-col-label">{c.label}</div>))}
      </div>
      {sites.map((s, ri) => (
        <div key={s.id} className="heatmap-row">
          <div className="heatmap-row-label">
            <div className="hm-site">{s.name}</div>
            <div className="hm-region mono">{s.code} · {s.region}</div>
          </div>
          {cls.map((c, ci) => {
            const list = matrix[ri][ci];
            return (
              <div key={c.id} className="heatmap-cell">
                <div className="hm-grid" style={{ "--n": Math.max(1, Math.ceil(Math.sqrt(list.length || 1))) }}>
                  {list.length === 0 && <div className="hm-empty"></div>}
                  {list.map(a => (
                    <button key={a.id} className={`hm-dot c-${a.code}`} title={`${a.tag} · ${a.name} · Score ${a.health}`} onClick={() => onPick && onPick(a)}>
                      <span className="hm-dot-score">{a.health}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ))}
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
  if (!trend) return null;
  const W = 760, H = height;
  const padL = 44, padR = 16, padT = 16, padB = 36;
  const pts = trend.points;
  const max = Math.max(trend.alarm * 1.1, ...pts.map(p => p.value));
  const min = 0;
  const xAt = (i) => padL + (i / (pts.length - 1)) * (W - padL - padR);
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
      <rect x={padL} y={yAt(trend.alarm)} width={W - padL - padR} height={H - padB - yAt(trend.alarm)} fill="var(--crit-bg)" />
      <rect x={padL} y={yAt(trend.warn)} width={W - padL - padR} height={yAt(trend.alarm) - yAt(trend.warn)} fill="var(--warn-bg)" />
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padT + t * (H - padT - padB);
        const v = max - t * (max - min);
        return (<g key={t}>
          <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="var(--line)" strokeWidth="0.6" />
          <text x={padL - 6} y={y + 3} textAnchor="end" style={{ fontSize: 10, fill: "var(--ink-3)", fontFamily: "var(--mono)" }}>{Math.round(v)}</text>
        </g>);
      })}
      {/* limit labels */}
      <line x1={padL} y1={yAt(trend.warn)} x2={W - padR} y2={yAt(trend.warn)} stroke="var(--warn)" strokeWidth="1" strokeDasharray="4 3" />
      <line x1={padL} y1={yAt(trend.alarm)} x2={W - padR} y2={yAt(trend.alarm)} stroke="var(--crit)" strokeWidth="1" strokeDasharray="4 3" />
      <text x={W - padR - 4} y={yAt(trend.warn) - 4}  textAnchor="end" style={{ fontSize: 10, fill: "var(--warn)", fontFamily: "var(--mono)" }}>WARN {trend.warn}</text>
      <text x={W - padR - 4} y={yAt(trend.alarm) - 4} textAnchor="end" style={{ fontSize: 10, fill: "var(--crit)", fontFamily: "var(--mono)" }}>ALARM {trend.alarm}</text>
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

window.HealthRadar = HealthRadar;
window.FleetHeatmap = FleetHeatmap;
window.Sparkline = Sparkline;
window.TrendChart = TrendChart;
window.RULBar = RULBar;
