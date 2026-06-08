/* =====================================================================
   data.js — Atomic Capital
   Mock market data + live-tick engine.
   Shape is intentionally close to a real quote feed so a live source
   (websocket / REST poll) can replace `startFeed()` later without
   touching the views. Every stock exposes: price, prevClose, change,
   changePct, day {o,h,l}, history[] (90d daily), intraday[] (live).
   ===================================================================== */
(function () {
  // deterministic-ish RNG so first paint is stable
  let _seed = 20260608;
  function rnd() { _seed = (_seed * 1664525 + 1013904223) % 4294967296; return _seed / 4294967296; }

  function genHistory(base, n, vol, drift) {
    // drift ≈ net trend strength; map to a sane net move over the window
    const trend = Math.max(-0.30, Math.min(0.55, drift * 0.16));
    const out = [];
    let wander = 0;
    for (let i = 0; i < n; i++) {
      const frac = i / (n - 1);                       // 0 → 1
      wander += (rnd() - 0.5) * vol * base * 0.9;      // random walk component
      wander *= 0.92;                                  // mean-revert
      const trendLine = base * (1 - trend * (1 - frac));
      out.push(+Math.max(base * 0.05, trendLine + wander).toFixed(2));
    }
    out[n - 1] = base;
    return out;
  }

  // base, name, sector, currency(USD|ZAR), vol, drift, logo color
  const DEF = [
    // ---- AI ----
    ["NVDA", "NVIDIA Corp",        "AI",        "USD", 178.40, 0.028, 0.9,  "#76B900"],
    ["AMD",  "Advanced Micro Dev", "AI",        "USD", 164.85, 0.030, 0.5,  "#ED1C24"],
    ["PLTR", "Palantir Tech",      "AI",        "USD", 88.20,  0.038, 1.2,  "#101113"],
    ["MSFT", "Microsoft Corp",     "AI",        "USD", 494.60, 0.016, 0.4,  "#2F7DF6"],
    ["GOOGL","Alphabet Inc",       "AI",        "USD", 187.95, 0.018, 0.5,  "#EA4335"],
    ["SMCI", "Super Micro",        "AI",        "USD", 47.30,  0.052, -0.4, "#0B6B3A"],
    // ---- Quantum ----
    ["IONQ", "IonQ Inc",           "Quantum",   "USD", 42.15,  0.060, 1.4,  "#7A2FF2"],
    ["RGTI", "Rigetti Computing",  "Quantum",   "USD", 18.40,  0.072, 1.8,  "#00C2B2"],
    ["QBTS", "D-Wave Quantum",     "Quantum",   "USD", 13.90,  0.068, 1.1,  "#1457E6"],
    ["IBM",  "IBM (Quantum)",      "Quantum",   "USD", 268.30, 0.015, 0.4,  "#0530AD"],
    // ---- Computing / semis ----
    ["AVGO", "Broadcom Inc",       "Computing", "USD", 241.70, 0.022, 0.7,  "#CC092F"],
    ["ARM",  "Arm Holdings",       "Computing", "USD", 154.20, 0.034, 0.6,  "#0091BD"],
    ["TSM",  "Taiwan Semi",        "Computing", "USD", 205.10, 0.020, 0.6,  "#D6001C"],
    ["ASML", "ASML Holding",       "Computing", "USD", 985.40, 0.019, 0.3,  "#0B5ED7"],
    ["MU",   "Micron Tech",        "Computing", "USD", 132.60, 0.030, 0.5,  "#0A2756"],
    // ---- SA / broad ----
    ["NPN",  "Naspers",            "SA",        "ZAR", 4862.0, 0.014, 0.3,  "#E4002B"],
    ["PRX",  "Prosus NV",          "SA",        "ZAR", 882.40, 0.016, 0.3,  "#16479E"],
    ["STXNDQ","Satrix Nasdaq 100", "Broad",     "ZAR", 104.85, 0.013, 0.5,  "#1B6FE0"],
    ["STX500","Satrix S&P 500",    "Broad",     "ZAR", 92.30,  0.011, 0.4,  "#10A86A"],
  ];

  const STOCKS = {};
  DEF.forEach(([sym, name, sector, cur, base, vol, drift, color]) => {
    const history = genHistory(base, 90, vol, drift);
    const prevClose = +(base * (1 - (rnd() - 0.45) * vol)).toFixed(2);
    // build an intraday line (today) from prevClose to current
    const intraday = genHistory(base, 78, vol * 0.5, (base - prevClose) / base / 0.4);
    intraday[0] = prevClose; intraday[intraday.length - 1] = base;
    STOCKS[sym] = {
      sym, name, sector, cur, color,
      price: base, prevClose,
      open: +(prevClose * (1 + (rnd() - 0.5) * vol * 0.4)).toFixed(2),
      dayHigh: base, dayLow: base,
      _vol: vol, history, intraday,
      mktCap: ["NVDA","MSFT","GOOGL","AVGO","TSM","ASML"].includes(sym) ? "trillion" : "mid",
    };
    const s = STOCKS[sym];
    s.dayHigh = Math.max(s.open, base, ...intraday);
    s.dayLow = Math.min(s.open, base, ...intraday);
    recompute(s);
  });

  function recompute(s) {
    s.change = +(s.price - s.prevClose).toFixed(2);
    s.changePct = +((s.change / s.prevClose) * 100).toFixed(2);
  }

  // ---------- Portfolio (EasyEquities-style: USD + ZAR sub-accounts) ----------
  const HOLDINGS = [
    { sym: "NVDA", shares: 18,  avg: 121.40, acct: "USD" },
    { sym: "PLTR", shares: 65,  avg: 52.10,  acct: "USD" },
    { sym: "IONQ", shares: 140, avg: 28.65,  acct: "USD" },
    { sym: "AMD",  shares: 22,  avg: 148.90, acct: "USD" },
    { sym: "MSFT", shares: 9,   avg: 432.00, acct: "USD" },
    { sym: "NPN",  shares: 12,  avg: 4180.0, acct: "ZAR" },
    { sym: "STXNDQ", shares: 320, avg: 88.40, acct: "ZAR" },
  ];

  const WATCH = ["RGTI", "QBTS", "ARM", "AVGO", "TSM", "GOOGL", "SMCI", "ASML"];

  const USDZAR = 18.42; // for blended total

  // ---------- AI signals ----------
  // reasoning keyed by risk appetite: cons | bal | agg
  const SIGNALS = [
    {
      sym: "NVDA", action: "buy", conf: 0.86, horizon: "2–4 weeks",
      timing: "Add on any dip below $172",
      drivers: ["Blackwell ramp", "Data-centre demand", "Above 50-day MA"],
      reason: {
        cons: "Core position is already in profit. If you want more exposure, scale in slowly — a third now, the rest only if it pulls back to the $168–172 support band. Keep it under 20% of the USD account.",
        bal:  "Momentum and earnings revisions are both positive and price is holding above its 50-day average. A staged buy over the next two weeks is reasonable; $172 is the level to lean on.",
        agg:  "Trend is intact and demand signals are strong. This is a high-conviction add — take a position now and add aggressively into any dip toward $172. Upside to $205 over the quarter."
      },
    },
    {
      sym: "IONQ", action: "hold", conf: 0.71, horizon: "1–3 months",
      timing: "Trim if it spikes past $48",
      drivers: ["High volatility", "Pre-revenue", "Quantum hype cycle"],
      reason: {
        cons: "You're up 47% on this — that's a lot of unrealised gain in a pre-revenue name. Lock in a third of the position. Quantum is a 5-year story, not a safe holding; keep the rest small.",
        bal:  "Let the winner run but stay disciplined: set a mental stop near your cost and trim if it spikes past $48. Position size is already meaningful at 140 shares.",
        agg:  "This is your quantum bet and it's working. Hold the full position; only trim into a parabolic move above $48 to bank some risk-free shares, then let the rest ride."
      },
    },
    {
      sym: "RGTI", action: "buy", conf: 0.64, horizon: "3–6 months",
      timing: "Starter position now",
      drivers: ["Gate-fidelity milestone", "Govt contracts", "Speculative"],
      reason: {
        cons: "This is too speculative for a conservative sleeve. If you must, cap it at 1% of the portfolio and treat the money as fully at-risk.",
        bal:  "A small starter position (≈2% of portfolio) gives you quantum optionality without betting the account. Buy once, don't average down on hype.",
        agg:  "Early-stage quantum with real milestones. Open a position now and add on contract news. Asymmetric upside — size it like a venture bet, ~4% of the account."
      },
    },
    {
      sym: "SMCI", action: "sell", conf: 0.78, horizon: "Now",
      timing: "Exit / avoid",
      drivers: ["Margin compression", "Below 200-day MA", "Accounting overhang"],
      reason: {
        cons: "Avoid. Falling below the 200-day average with an unresolved accounting overhang is exactly the kind of risk a conservative book should sidestep.",
        bal:  "The technical picture has broken down and the fundamental overhang isn't resolved. If you held this, reduce. Better risk/reward elsewhere in AI infrastructure.",
        agg:  "Even for an aggressive book this is a falling knife — broken trend plus headline risk. Stand aside until it reclaims the 200-day; there are cleaner momentum names."
      },
    },
    {
      sym: "AVGO", action: "buy", conf: 0.80, horizon: "1–2 months",
      timing: "Accumulate under $238",
      drivers: ["Custom AI silicon", "Dividend growth", "Strong FCF"],
      reason: {
        cons: "A higher-quality way to own the AI infrastructure theme — profitable, cash-generative, pays a growing dividend. Accumulate slowly under $238; suits a conservative sleeve.",
        bal:  "Quality compounder with real AI exposure through custom silicon. Build a position on weakness under $238 and hold through the cycle.",
        agg:  "Underowned relative to NVDA but levered to the same demand. Accumulate now; custom-silicon wins could re-rate it. Add under $238."
      },
    },
  ];

  // ---------- news (with model sentiment) ----------
  const NEWS = {
    NVDA: [
      { src: "Reuters", time: "2h", sent: "pos", title: "NVIDIA Blackwell shipments ahead of schedule, supply easing into Q3" },
      { src: "Bloomberg", time: "6h", sent: "neu", title: "Analysts split on whether AI capex pace is sustainable into 2027" },
      { src: "CNBC", time: "1d", sent: "pos", title: "Hyperscaler orders point to another record data-centre quarter" },
    ],
    IONQ: [
      { src: "The Verge", time: "4h", sent: "pos", title: "IonQ hits 99.9% two-qubit gate fidelity on Forte Enterprise" },
      { src: "Barron's", time: "1d", sent: "neg", title: "Quantum names look stretched after 60% run, says strategist" },
    ],
    RGTI: [
      { src: "Reuters", time: "8h", sent: "pos", title: "Rigetti wins DARPA quantum benchmarking contract" },
    ],
    SMCI: [
      { src: "WSJ", time: "3h", sent: "neg", title: "Super Micro margins under pressure as competition intensifies" },
      { src: "Bloomberg", time: "1d", sent: "neg", title: "Auditor questions linger; stock slips below 200-day average" },
    ],
    AVGO: [
      { src: "Bloomberg", time: "5h", sent: "pos", title: "Broadcom custom AI chip pipeline draws second hyperscaler" },
    ],
  };
  // generic fallback news
  function newsFor(sym) {
    return NEWS[sym] || [
      { src: "Market wire", time: "3h", sent: "neu", title: `${STOCKS[sym].name} trades in line with the ${STOCKS[sym].sector} sector` },
      { src: "Reuters", time: "1d", sent: "neu", title: `Sector rotation keeps ${sym} range-bound ahead of earnings` },
    ];
  }

  // ---------- live tick engine ----------
  const subs = new Set();
  let timer = null, running = false;
  function tick() {
    for (const sym in STOCKS) {
      const s = STOCKS[sym];
      const drift = (rnd() - 0.5) * s._vol * 0.16;
      const np = Math.max(0.5, +(s.price * (1 + drift)).toFixed(2));
      s.prevTick = s.price; s.price = np;
      if (np > s.dayHigh) s.dayHigh = np;
      if (np < s.dayLow) s.dayLow = np;
      s.intraday.push(np); if (s.intraday.length > 90) s.intraday.shift();
      recompute(s);
    }
    subs.forEach(fn => { try { fn(); } catch (e) {} });
  }
  function startFeed(ms = 1600) { if (running) return; running = true; timer = setInterval(tick, ms); }
  function stopFeed() { running = false; clearInterval(timer); }
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

  // market session (SAST). JSE 09:00–17:00, NYSE 15:30–22:00 SAST.
  function sessions() {
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    return {
      jse:  { name: "JSE",  open: h >= 9 && h < 17 },
      nyse: { name: "NYSE", open: h >= 15.5 && h < 22 },
    };
  }

  window.AtomicData = {
    STOCKS, HOLDINGS, WATCH, SIGNALS, USDZAR,
    newsFor, startFeed, stopFeed, subscribe, sessions, recompute,
    list: () => Object.values(STOCKS),
    get: (s) => STOCKS[s],
  };
})();
