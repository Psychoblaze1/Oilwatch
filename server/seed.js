// Seed the SQLite DB with a piston-aviation fleet on first run.
// Generator mirrors public/src/data.jsx so the demo loads with the
// same shape it had when data was client-side.

const { db } = require("./db");

const SITES = [
  { id: "ctn-01", code: "KAPA", name: "Centennial Flight Academy", region: "Denver, CO",   assets: 38, samples28d: 412 },
  { id: "sun-02", code: "KSUN", name: "Sun Valley FBO",            region: "Hailey, ID",   assets: 22, samples28d: 198 },
  { id: "hef-03", code: "KHEF", name: "Cirrus East Charter",       region: "Manassas, VA", assets: 28, samples28d: 251 },
  { id: "ict-04", code: "KICT", name: "Beechwood Aero Service",    region: "Wichita, KS",  assets: 54, samples28d: 537 },
  { id: "hwd-05", code: "KHWD", name: "Pacific Coast Flying Club", region: "Hayward, CA",  assets: 44, samples28d: 489 },
  { id: "afa-06", code: "PAFA", name: "Alaska Bush Operators",     region: "Fairbanks, AK",assets: 18, samples28d: 142 },
];

const ASSET_CLASSES = [
  { id: "lyco4",  label: "Lycoming 4-cyl" },
  { id: "lyco6",  label: "Lycoming 6-cyl" },
  { id: "conto4", label: "Continental 4"  },
  { id: "conto6", label: "Continental 6"  },
  { id: "rotax",  label: "Rotax"          },
  { id: "radial", label: "Radial"         },
];

const ASSET_NAMES = {
  lyco4: ["N7251X · Cessna 172S","N9412A · Piper PA-28-180","N3308G · Diamond DA40","N5572K · Citabria 7ECA","N8841J · Maule M-7-235","N6620B · American Champion Decathlon"],
  lyco6: ["N4419C · Cirrus SR22","N7785M · Mooney M20TN","N2207V · Piper Saratoga","N5530W · Beechcraft A36 Bonanza","N9912T · Piper Cherokee Six 300","N1147H · Mooney M20R"],
  conto4:["N3015F · Cessna 152","N6608R · Cirrus SR20","N4421P · Mooney M20E","N7780Q · Diamond DA20-C1","N1183Y · Grumman AA-5A Cheetah","N5519N · Cessna 150"],
  conto6:["N3458S · Beechcraft V35 Bonanza","N7790T · Cessna T210M","N1234U · Piper Twin Comanche","N5687V · Beechcraft Baron 58","N9012W · Cessna 310R","N4451B · Cessna P210N"],
  rotax: ["N7716X · Diamond DA20-A1","N3320Y · Tecnam P2008","N4408Z · CTLS Flight Design","N9981A · ICON A5","N5527B · Aeroprakt A22","N6620C · Pipistrel Sinus"],
  radial:["N1198CC · Cessna 195","N5512DD · DC-3","N9022EE · T-28B Trojan","N3340FF · Antonov An-2"],
};
const ENGINE_TAGS = {
  lyco4:  ["O-320-D3G","O-360-A1A","IO-360-L2A","IO-320-A2A","O-320-H2AD","IO-360-M1A"],
  lyco6:  ["IO-540-AB1A5","IO-540-K1A5","TIO-540-AE2A","IO-580-B1A","IO-540-C4B5"],
  conto4: ["O-200-A","IO-240-B","IO-360-ES","O-200-D"],
  conto6: ["IO-470-N","IO-520-D","IO-550-G","TSIO-550-K","IO-550-N"],
  rotax:  ["912 ULS-2","912 iS Sport","914 UL","915 iSc3 A"],
  radial: ["R-985-AN-14B","R-1340-AN-1","R-2800-CB16"],
};

function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function scoreToCode(s) { return s >= 75 ? 1 : s >= 50 ? 2 : s >= 25 ? 3 : 4; }
function daysAgo(d) { const x = new Date(); x.setDate(x.getDate() - d); return x.toISOString(); }
function daysFromNow(d) { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString(); }

function makeDimensions(rng, base, cls) {
  const sets = {
    lyco4: ["Wear","Cylinders","Contamination"],
    lyco6: ["Wear","Cam/Lifter","Cylinders","Contamination"],
    conto4:["Wear","Cylinders","Contamination"],
    conto6:["Wear","Cylinders","Cam","Contamination"],
    rotax: ["Wear","Coolant","Gearbox","Contamination"],
    radial:["Wear","Master Rod","Cylinders","Oxidation"],
  };
  const dims = sets[cls] || ["Wear","Contamination","Chemistry"];
  return dims.map(d => {
    const jitter = (rng() - 0.5) * 30;
    const score = Math.max(2, Math.min(99, Math.floor(base + jitter)));
    return { label: d, score, code: scoreToCode(score) };
  });
}
function pickOilForClass(cls, rng) {
  if (cls === "rotax") return { brand: "AeroShell", name: "AeroShell Sport Plus 4", iso: "SAE 10W-40" };
  const pool = [
    { brand: "AeroShell",  name: "AeroShell W100 Plus",  iso: "SAE 50" },
    { brand: "AeroShell",  name: "AeroShell 15W-50",     iso: "SAE 15W-50" },
    { brand: "Phillips 66",name: "Phillips X/C 20W-50",  iso: "SAE 20W-50" },
    { brand: "ExxonMobil", name: "Exxon Elite 20W-50",   iso: "SAE 20W-50" },
  ];
  return pool[Math.floor(rng() * pool.length)];
}
function pickComponent(rng, cls) {
  const opts = {
    lyco4: ["Sump Drain","Filter Cut","Suction Screen"],
    lyco6: ["Sump Drain","Filter Cut","Suction Screen","Quick-Drain"],
    conto4:["Sump Drain","Filter Cut","Suction Screen"],
    conto6:["Sump Drain","Filter Cut","Suction Screen","Quick-Drain"],
    rotax: ["Sump Drain","Filter Cut","Gearbox Drain"],
    radial:["Sump Drain","Filter Cut","Suction Screen","Tank Drain"],
  };
  const arr = opts[cls] || ["Sump Drain"];
  return arr[Math.floor(rng() * arr.length)];
}
function pickAnalyst(rng) {
  const list = ["M. Okafor","R. Pillai","S. Henningsen","T. Reyes","D. Vaughn","J. Park"];
  return list[Math.floor(rng() * list.length)];
}
function pickFlags(rng, score) {
  const f = [];
  if (score < 55 && rng() < 0.7) f.push("Fe↑");
  if (score < 50 && rng() < 0.55) f.push("Cr↑");
  if (score < 60 && rng() < 0.40) f.push("Al↑");
  if (score < 60 && rng() < 0.50) f.push("H₂O");
  if (score < 50 && rng() < 0.45) f.push("Fuel%");
  if (score < 55 && rng() < 0.35) f.push("Si↑");
  if (score < 35 && rng() < 0.4)  f.push("Visc Δ");
  return f;
}

// Param defs (mirror of public/src/data.jsx PARAM_DEFS)
const PARAM_DEFS = [
  { code: "Fe",      name: "Iron",          unit: "ppm",      method: "ASTM D5185",  warn: 35,    alarm: 65,    target: null, kind: "num" },
  { code: "Cr",      name: "Chromium",      unit: "ppm",      method: "ASTM D5185",  warn: 5,     alarm: 10,    target: null, kind: "num" },
  { code: "Al",      name: "Aluminum",      unit: "ppm",      method: "ASTM D5185",  warn: 8,     alarm: 15,    target: null, kind: "num" },
  { code: "Cu",      name: "Copper",        unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 35,    target: null, kind: "num" },
  { code: "Pb",      name: "Lead (100LL)",  unit: "ppm",      method: "ASTM D5185",  warn: 8000,  alarm: 12000, target: null, kind: "num" },
  { code: "Ni",      name: "Nickel",        unit: "ppm",      method: "ASTM D5185",  warn: 3,     alarm: 6,     target: null, kind: "num" },
  { code: "Si",      name: "Silicon",       unit: "ppm",      method: "ASTM D5185",  warn: 15,    alarm: 30,    target: null, kind: "num" },
  { code: "Visc100", name: "Visc @ 100°C",  unit: "cSt",      method: "ASTM D445",   warn: "±10%",alarm: "±15%",target: 19,   kind: "pct" },
  { code: "H2O",     name: "Water",         unit: "ppm",      method: "ASTM D6304",  warn: 200,   alarm: 500,   target: null, kind: "num" },
  { code: "Fuel",    name: "Fuel Dilution", unit: "%",        method: "GC",          warn: 2,     alarm: 4,     target: null, kind: "num" },
];

function evalStatus(p) {
  if (typeof p.alarm === "number" && typeof p.value === "number") {
    if (p.value >= p.alarm) return "alarm";
    if (p.value >= p.warn)  return "warn";
    return "ok";
  }
  if (p.code === "Visc100" && typeof p.value === "number" && p.target) {
    const dev = Math.abs(p.value - p.target) / p.target;
    if (dev > 0.15) return "alarm";
    if (dev > 0.10) return "warn";
    return "ok";
  }
  return "ok";
}

function makeResults(score, rng) {
  // Store raw instrument readings only. Warn/alarm/status are joined
  // client-side from current limits so threshold edits re-evaluate
  // historical samples without a backfill.
  const bad = score < 55, sev = score < 30;
  const baseValues = {
    Fe:      sev ? 78 : bad ? 42 : 12 + Math.floor(rng()*14),
    Cr:      sev ? 14 : bad ? 7  : 1 + Math.floor(rng()*3),
    Al:      sev ? 22 : bad ? 11 : 2 + Math.floor(rng()*4),
    Cu:      sev ? 48 : bad ? 22 : 4 + Math.floor(rng()*8),
    Pb:      4000 + Math.floor(rng() * 3500) + (bad ? 1500 : 0),
    Ni:      sev ? 8 : bad ? 3 : Math.floor(rng()*2),
    Si:      sev ? 36 : bad ? 18 : 4 + Math.floor(rng()*7),
    Visc100: bad ? 16.4 : Number((19.0 + (rng()-0.5)*1.2).toFixed(2)),
    H2O:     sev ? 720 : bad ? 320 : 40 + Math.floor(rng()*80),
    Fuel:    sev ? 5.2 : bad ? 2.4 : Number((rng()*0.8).toFixed(2)),
  };
  return Object.entries(baseValues).map(([code, value]) => ({ code, value }));
}

const RULE_SEED = [
  { id: "R-001", name: "Cam/lifter wear pattern (Lycoming)", enabled: true, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6"] },
    conditions: [{ param: "Fe", op: ">", value: 35 }, { param: "Cr", op: ">", value: 5 }],
    action: "alarm", createdAt: "2026-04-12T14:00:00Z", lastTriggered: "2026-05-08T06:14:00Z" },
  { id: "R-002", name: "Viscosity drop > 15% — fuel dilution suspected", enabled: true, severity: "CRITICAL",
    scope: { classes: "all" }, conditions: [{ param: "Visc100", op: "abs%>", value: 15 }],
    action: "alarm", createdAt: "2026-03-30T10:00:00Z", lastTriggered: "2026-05-10T22:01:00Z" },
  { id: "R-003", name: "Aluminum spike — piston scuff", enabled: true, severity: "SEVERE",
    scope: { classes: "all" }, conditions: [{ param: "Al", op: ">", value: 15 }],
    action: "alarm", createdAt: "2026-02-18T09:00:00Z", lastTriggered: "2026-05-11T03:22:00Z" },
  { id: "R-004", name: "Water > 500 ppm — short-flight condensation", enabled: true, severity: "WARN",
    scope: { classes: "all" }, conditions: [{ param: "H2O", op: ">", value: 500 }],
    action: "notify", createdAt: "2026-02-05T12:00:00Z", lastTriggered: "2026-04-29T16:00:00Z" },
  { id: "R-005", name: "Fuel dilution > 4% — mag check needed", enabled: true, severity: "CRITICAL",
    scope: { classes: ["lyco4","lyco6","conto4","conto6"] },
    conditions: [{ param: "Fuel", op: ">", value: 4 }],
    action: "alarm", createdAt: "2026-01-22T09:00:00Z", lastTriggered: null },
  { id: "R-006", name: "Copper Z-score anomaly (oil-cooler corrosion)", enabled: false, severity: "WARN",
    scope: { classes: "all" }, conditions: [{ param: "Cu", op: "z>", value: 2.0 }],
    action: "flag", createdAt: "2026-01-09T08:00:00Z", lastTriggered: null },
];

function seed() {
  const tx = db.transaction(() => {
    const insertSite = db.prepare("INSERT INTO sites (id, code, name, region, assets_count, samples28d) VALUES (?, ?, ?, ?, ?, ?)");
    for (const s of SITES) insertSite.run(s.id, s.code, s.name, s.region, s.assets, s.samples28d);

    const insertEngine = db.prepare(`
      INSERT INTO engines (id, tag, name, site, class, class_label, oem, oil_brand, oil_name, oil_iso,
                           run_hours, criticality, health, code, dimensions_json, last_sample, next_due, rul_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSample = db.prepare(`
      INSERT INTO samples (id, barcode, engine_id, component, oil_name, received_at,
                           status, priority, score, code, analyst, flags_json, results_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const rng = mulberry32(7);
    let engineId = 1000, sampleId = 50231;
    const allEngines = [];

    for (const site of SITES) {
      const count = Math.max(6, Math.min(14, Math.floor(site.assets / 4)));
      for (let i = 0; i < count; i++) {
        const cls = ASSET_CLASSES[Math.floor(rng() * ASSET_CLASSES.length)];
        const name = ASSET_NAMES[cls.id][Math.floor(rng() * ASSET_NAMES[cls.id].length)];
        const tag  = ENGINE_TAGS[cls.id][Math.floor(rng() * ENGINE_TAGS[cls.id].length)];
        const r = rng();
        let score = r < 0.55 ? 78 + Math.floor(rng() * 20)
                  : r < 0.82 ? 55 + Math.floor(rng() * 22)
                  : r < 0.95 ? 28 + Math.floor(rng() * 20)
                  : 6 + Math.floor(rng() * 18);
        const oil = pickOilForClass(cls.id, rng);
        const oem = cls.id.startsWith("lyco") ? "Lycoming"
                  : cls.id.startsWith("conto") ? "Continental Motors"
                  : cls.id === "rotax" ? "Rotax"
                  : cls.id === "radial" ? "Pratt & Whitney" : "Lycoming";
        const engine = {
          id: "A-" + (engineId++), tag, name, site: site.id,
          class: cls.id, classLabel: cls.label, oem,
          oil_brand: oil.brand, oil_name: oil.name, oil_iso: oil.iso,
          runHours: 80 + Math.floor(rng() * 2400),
          criticality: rng() < 0.25 ? "A" : (rng() < 0.6 ? "B" : "C"),
          health: score, code: scoreToCode(score),
          dimensions: makeDimensions(rng, score, cls.id),
          lastSample: daysAgo(Math.floor(rng() * 26)),
          nextDue:    daysFromNow(Math.floor(rng() * 60) - 5),
          rulDays:    Math.max(8, Math.floor(score * 1.6) + Math.floor(rng() * 30)),
        };
        insertEngine.run(engine.id, engine.tag, engine.name, engine.site, engine.class, engine.classLabel,
          engine.oem, engine.oil_brand, engine.oil_name, engine.oil_iso,
          engine.runHours, engine.criticality, engine.health, engine.code,
          JSON.stringify(engine.dimensions), engine.lastSample, engine.nextDue, engine.rulDays);
        allEngines.push(engine);
      }
    }

    const sampleRng = mulberry32(13);
    for (const a of allEngines) {
      const n = 1 + Math.floor(sampleRng() * 3);
      for (let i = 0; i < n; i++) {
        const ageDays = Math.floor(sampleRng() * 28);
        const status = ageDays < 1 ? "DRAFT"
                      : ageDays < 3 ? (sampleRng() < 0.5 ? "QC" : "DRAFT")
                      : ageDays < 6 ? (sampleRng() < 0.6 ? "APPROVED" : "QC")
                      : (sampleRng() < 0.08 ? "REJECTED" : "PUBLISHED");
        const noise = (sampleRng() - 0.5) * 12;
        const score = Math.max(4, Math.min(99, Math.floor(a.health + noise)));
        const id = "S-" + (sampleId++);
        const flags = pickFlags(sampleRng, score);
        const results = status === "DRAFT" ? null : makeResults(score, mulberry32(parseInt(id.slice(2), 10)));
        insertSample.run(
          id,
          "AOA" + (240000 + Math.floor(sampleRng() * 9999)),
          a.id,
          pickComponent(sampleRng, a.class),
          a.oil_name,
          daysAgo(ageDays),
          status,
          sampleRng() < 0.12 ? "RUSH" : "STD",
          score,
          scoreToCode(score),
          pickAnalyst(sampleRng),
          JSON.stringify(flags),
          results ? JSON.stringify(results) : null
        );
      }
    }

    // Alarms — seed from worst-health engines.
    const insertAlarm = db.prepare(`
      INSERT INTO alarms (id, engine_id, severity, code, rule, raised_at, rul_days, acknowledged)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const aRng = mulberry32(101);
    const candidates = allEngines.filter(a => a.health < 70).sort((a,b) => a.health - b.health);
    for (const a of candidates.slice(0, 14)) {
      const t = aRng();
      const rule = a.health < 25 ? "Condemning limits exceeded — recommend immediate pull, borescope, and oil-filter cut."
                : a.health < 50 ? (t < 0.5
                    ? "Cam/lifter wear signature — Fe + Cr running together (Lycoming pattern)."
                    : "Iron trend +3 consecutive · ΔFe 22 ppm in 1 interval — cylinder or cam.")
                : (t < 0.5
                    ? "Viscosity dropped ~15% — possible fuel dilution from mag drop or rich operation."
                    : "Z-score anomaly on Cu (2.6σ above baseline) — possible oil-cooler corrosion.");
      insertAlarm.run(
        "AL-" + Math.floor(10000 + aRng()*89999),
        a.id,
        a.health < 25 ? "SEVERE" : a.health < 50 ? "CRITICAL" : "WARN",
        a.code, rule,
        daysAgo(Math.floor(aRng() * 9)),
        a.rulDays,
        aRng() < 0.3 ? 1 : 0
      );
    }

    // Rules.
    const insertRule = db.prepare(`
      INSERT INTO rules (id, name, enabled, severity, scope_json, conditions_json, action, created_at, last_triggered)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    for (const r of RULE_SEED) {
      insertRule.run(r.id, r.name, r.enabled ? 1 : 0, r.severity,
        JSON.stringify(r.scope), JSON.stringify(r.conditions), r.action,
        r.createdAt, r.lastTriggered);
    }
  });
  tx();
}

module.exports = { seed };
