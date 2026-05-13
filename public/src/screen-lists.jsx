// ============================================================
// Samples list screen (lightweight) + Assets list + Alarms list + Reference
// (Compact secondary screens accessed from nav)
// ============================================================

function ScreenSamples({ siteFilter, focus, setRoute }) {
  const [status, setStatus] = React.useState("ALL");
  const [q, setQ] = React.useState("");
  const assets = siteFilter === "all" ? window.ASSETS : window.ASSETS.filter(a => a.site === siteFilter);
  let list = window.SAMPLES.filter(s => assets.find(a => a.id === s.assetId));
  if (status !== "ALL") list = list.filter(s => s.status === status);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(s => s.id.toLowerCase().includes(ql) || s.assetName.toLowerCase().includes(ql) || s.assetTag.toLowerCase().includes(ql) || s.barcode.includes(q));
  }

  const tabs = ["ALL","DRAFT","QC","APPROVED","PUBLISHED","REJECTED"];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Samples</h1>
          <div className="page-sub">{list.length} samples · 28-day window</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> Filters</button>
          <button className="btn btn-ghost" onClick={() => window.exportCSV(
            list.map(s => ({
              sample: s.id, asset: s.assetName, tag: s.assetTag, site: s.siteName,
              component: s.component, received: window.fmtDate(s.receivedAt),
              score: s.score, cond: s.code, flags: s.flags.join("|"),
              analyst: s.analyst, status: s.status, barcode: s.barcode,
            })),
            `oilwatch-samples-${new Date().toISOString().slice(0,10)}.csv`
          )}><Icon name="download" size={14}/> Export CSV</button>
          <button className="btn btn-primary" onClick={() => setRoute && setRoute("log-sample")}><Icon name="plus" size={14}/> Log sample</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {tabs.map(t => (
            <button key={t} className={`btn btn-sm ${status === t ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatus(t)}>{t}</button>
          ))}
        </div>
        <div className="top-search" style={{ marginLeft: "auto", minWidth: 280 }}>
          <Icon name="search" size={14} style={{ opacity: 0.5 }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter by ID, asset, barcode…"/>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr>
              <th>Sample</th><th>Asset</th><th>Site</th><th>Component</th><th>Received</th><th>Score</th><th>Flags</th><th>Analyst</th><th>Status</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 40).map(s => (
                <tr key={s.id} onClick={() => focus(s.id, "sample")}>
                  <td className="mono t-id">{s.id}</td>
                  <td>{s.assetName} <span className="mono muted">· {s.assetTag}</span></td>
                  <td className="t-muted">{s.siteName}</td>
                  <td>{s.component}</td>
                  <td className="mono t-muted">{window.fmtShortDate(s.receivedAt)}</td>
                  <td><Chip code={s.code}>{s.score}</Chip></td>
                  <td><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{s.flags.slice(0, 3).map(f => <Tag key={f}>{f}</Tag>)}</div></td>
                  <td className="t-muted">{s.analyst}</td>
                  <td><span className="status-pill" data-s={s.status}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScreenAssets({ siteFilter, focus }) {
  const [cls, setCls] = React.useState("ALL");
  const [q, setQ] = React.useState("");
  let list = siteFilter === "all" ? window.ASSETS : window.ASSETS.filter(a => a.site === siteFilter);
  if (cls !== "ALL") list = list.filter(a => a.class === cls);
  if (q) {
    const ql = q.toLowerCase();
    list = list.filter(a => a.name.toLowerCase().includes(ql) || a.tag.toLowerCase().includes(ql));
  }
  list = list.slice().sort((a, b) => a.health - b.health);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Assets</h1>
          <div className="page-sub">{list.length} assets · sorted by health, worst first</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost"><Icon name="filter" size={14}/> Criticality</button>
          <button className="btn btn-ghost" onClick={() => window.exportCSV(
            list.map(a => ({
              asset: a.name, tag: a.tag, class: a.classLabel, site: a.siteName,
              score: a.health, cond: a.code, rul_days: a.rulDays,
              run_hours: a.runHours, criticality: a.criticality,
              last_sample: window.fmtDate(a.lastSample), next_due: window.fmtDate(a.nextDue),
              oil: `${a.oil.brand} ${a.oil.name}`, oem: a.oem,
            })),
            `oilwatch-assets-${new Date().toISOString().slice(0,10)}.csv`
          )}><Icon name="download" size={14}/> Export CSV</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 4 }}>
          <button className={`btn btn-sm ${cls === "ALL" ? "btn-primary" : "btn-ghost"}`} onClick={() => setCls("ALL")}>All</button>
          {window.ASSET_CLASSES.map(c => (
            <button key={c.id} className={`btn btn-sm ${cls === c.id ? "btn-primary" : "btn-ghost"}`} onClick={() => setCls(c.id)}>{c.label}</button>
          ))}
        </div>
        <div className="top-search" style={{ marginLeft: "auto", minWidth: 280 }}>
          <Icon name="search" size={14} style={{ opacity: 0.5 }}/>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Filter…"/>
        </div>
      </div>

      <div className="card">
        <div className="card-body no-pad">
          <table className="table">
            <thead><tr>
              <th>Asset</th><th>Tag</th><th>Class</th><th>Site</th><th>Score</th><th>RUL</th><th>Run hrs</th><th>Crit</th><th>Last sample</th>
            </tr></thead>
            <tbody>
              {list.slice(0, 40).map(a => (
                <tr key={a.id} onClick={() => focus(a.id)}>
                  <td>{a.name}</td>
                  <td className="mono t-id">{a.tag}</td>
                  <td className="t-muted">{a.classLabel}</td>
                  <td className="t-muted">{a.siteName}</td>
                  <td><Chip code={a.code}>{a.health}</Chip></td>
                  <td><div style={{ minWidth: 140 }}><RULBar days={a.rulDays} total={120}/></div></td>
                  <td className="mono t-muted">{a.runHours.toLocaleString()}</td>
                  <td><Tag tone="accent">{a.criticality}</Tag></td>
                  <td className="mono t-muted">{window.fmtShortDate(a.lastSample)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScreenAlarms({ siteFilter, focus }) {
  const assets = siteFilter === "all" ? window.ASSETS : window.ASSETS.filter(a => a.site === siteFilter);
  const [, force] = React.useReducer(x => x + 1, 0);
  const alarms = window.ALARMS.filter(a => assets.find(x => x.id === a.assetId));

  const ack = async (id) => {
    const i = window.ALARMS.findIndex(a => a.id === id);
    if (i >= 0) window.ALARMS[i] = { ...window.ALARMS[i], acknowledged: true };
    force();
    try { await window.api.ackAlarm(id, true); } catch (e) { console.error("ack failed", e); }
  };
  const ackAll = async () => {
    for (const al of alarms) {
      const i = window.ALARMS.findIndex(a => a.id === al.id);
      if (i >= 0) window.ALARMS[i] = { ...window.ALARMS[i], acknowledged: true };
    }
    force();
    try { await window.api.ackAllAlarms(); } catch (e) { console.error("ackAll failed", e); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Alarms</h1>
          <div className="page-sub">{alarms.length} active · {alarms.filter(a => !a.acknowledged).length} unacknowledged</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-ghost" onClick={ackAll}>Acknowledge all</button>
          <button className="btn btn-primary"><Icon name="ai" size={14}/> AI triage</button>
        </div>
      </div>
      <div className="card">
        <div className="card-body no-pad">
          {alarms.map((al, i) => (
            <div key={al.id} style={{
              display: "grid", gridTemplateColumns: "auto 1fr 240px auto auto", gap: 16, alignItems: "center", width: "100%",
              padding: "14px 18px", borderBottom: i < alarms.length - 1 ? "1px solid var(--line)" : "none",
              opacity: al.acknowledged ? 0.55 : 1
            }}>
              <Chip code={al.code} size="md">{al.severity}</Chip>
              <button onClick={() => focus(al.assetId)} style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13.5, fontWeight: 500, marginBottom: 3 }}>{al.assetName} <span className="mono muted">· {al.assetTag}</span></div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{al.rule}</div>
                <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", marginTop: 4, letterSpacing: 0.05 }}>
                  {al.site.toUpperCase()} · RAISED {window.fmtShortDate(al.raisedAt)}
                </div>
              </button>
              <RULBar days={al.rulDays} total={120}/>
              {al.acknowledged
                ? <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)" }}>ACK</span>
                : <button className="btn btn-sm" onClick={() => ack(al.id)}><Icon name="check" size={12}/> Ack</button>}
              <Icon name="chevron-r" size={14} style={{ color: "var(--ink-3)" }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScreenRef() {
  const groups = [
    { title: "Aviation Oils", items: window.OILS.map(o => ({ name: o.name, sub: `${o.brand} · ${o.iso}` })) },
    { title: "Parameters", items: [
      { name: "Iron (Fe)",            sub: "ASTM D5185 · ICP-OES · cylinders, cam, lifters" },
      { name: "Chromium (Cr)",        sub: "ASTM D5185 · piston rings, valves" },
      { name: "Aluminum (Al)",        sub: "ASTM D5185 · pistons, oil pump body" },
      { name: "Copper (Cu)",          sub: "ASTM D5185 · bronze bushings, oil cooler" },
      { name: "Lead (Pb)",            sub: "ASTM D5185 · 100LL avgas residue · 4-7k ppm normal" },
      { name: "Silicon (Si)",         sub: "ASTM D5185 · airborne dirt / induction leak" },
      { name: "Water (H₂O)",          sub: "ASTM D6304 · Karl Fischer · short-flight condensation" },
      { name: "Viscosity @ 100°C",    sub: "ASTM D445 · SAE 50 ≈ 19 cSt · drop = fuel dilution" },
      { name: "Fuel Dilution",        sub: "GC · rich operation / mag check indicator" },
    ]},
    { title: "Engine Defaults", items: window.ASSET_CLASSES.map(c => ({ name: c.label, sub: "Standard limit set · 25–50 hr drain cadence" })) },
  ];
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reference Library</h1>
          <div className="page-sub">OEM specs, test methods, and limit sets</div>
        </div>
      </div>
      <div className="grid-3">
        {groups.map((g, i) => (
          <div key={i} className="card">
            <div className="card-head"><span className="card-title">{g.title}</span></div>
            <div className="card-body no-pad">
              {g.items.map((it, k) => (
                <div key={k} style={{ padding: "10px 16px", borderBottom: k < g.items.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <div style={{ fontSize: 13 }}>{it.name}</div>
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--ink-3)", letterSpacing: 0.05, marginTop: 2 }}>{it.sub.toUpperCase()}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

window.ScreenSamples = ScreenSamples;
window.ScreenAssets = ScreenAssets;
window.ScreenAlarms = ScreenAlarms;
window.ScreenRef = ScreenRef;
