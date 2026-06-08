// quotes.js — real market data for Atomic Capital
//
// Pulls live quotes + history from Yahoo Finance's public chart endpoint
// (no API key required). Normalises everything to the shape public/data.js
// already expects, so the views don't change. JSE tickers are quoted in
// cents (currency "ZAc") and converted to Rand here.
//
// Results are cached briefly so client polling doesn't hammer Yahoo.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// app symbol -> Yahoo symbol (JSE names get a .JO suffix)
const SYMBOL_MAP = {
  NVDA: "NVDA", AMD: "AMD", PLTR: "PLTR", MSFT: "MSFT", GOOGL: "GOOGL", SMCI: "SMCI",
  IONQ: "IONQ", RGTI: "RGTI", QBTS: "QBTS", IBM: "IBM",
  AVGO: "AVGO", ARM: "ARM", TSM: "TSM", ASML: "ASML", MU: "MU",
  NPN: "NPN.JO", PRX: "PRX.JO", STXNDQ: "STXNDQ.JO", STX500: "STX500.JO",
};
const ALL_SYMBOLS = Object.keys(SYMBOL_MAP);

async function fetchChart(yahooSym, range, interval) {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSym)}` +
    `?interval=${interval}&range=${range}`;
  const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!r.ok) throw new Error(`Yahoo ${yahooSym} HTTP ${r.status}`);
  const j = await r.json();
  const res = j?.chart?.result?.[0];
  if (!res || !res.meta) throw new Error(`Yahoo ${yahooSym}: empty result`);
  const meta = res.meta;
  const closes = (res.indicators?.quote?.[0]?.close || []).filter((x) => x != null);
  return { meta, closes };
}

// Yahoo gives JSE prices in cents (currency "ZAc"). Divide to get Rand.
function scaleFor(meta) {
  return meta.currency === "ZAc" ? 0.01 : 1;
}
function curFor(meta) {
  return meta.currency === "ZAc" ? "ZAR" : meta.currency || "USD";
}

// --- lightweight current quote (for polling) -------------------------------
async function quoteOne(appSym) {
  const { meta } = await fetchChart(SYMBOL_MAP[appSym], "1d", "1d");
  const k = scaleFor(meta);
  const price = +(meta.regularMarketPrice * k);
  const prevClose = +((meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice) * k);
  return {
    sym: appSym,
    price: +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    change: +(price - prevClose).toFixed(2),
    changePct: +(((price - prevClose) / prevClose) * 100).toFixed(2),
    open: meta.regularMarketOpen != null ? +(meta.regularMarketOpen * k).toFixed(2) : +price.toFixed(2),
    dayHigh: meta.regularMarketDayHigh != null ? +(meta.regularMarketDayHigh * k).toFixed(2) : +price.toFixed(2),
    dayLow: meta.regularMarketDayLow != null ? +(meta.regularMarketDayLow * k).toFixed(2) : +price.toFixed(2),
    cur: curFor(meta),
    marketOpen: meta.marketState ? meta.marketState === "REGULAR" : undefined,
  };
}

// --- full snapshot (price + 90d history + today's intraday) ----------------
async function bootstrapOne(appSym) {
  const yahoo = SYMBOL_MAP[appSym];
  const [daily, intra] = await Promise.allSettled([
    fetchChart(yahoo, "6mo", "1d"),
    fetchChart(yahoo, "1d", "5m"),
  ]);
  if (daily.status !== "fulfilled") throw daily.reason;
  const { meta, closes } = daily.value;
  const k = scaleFor(meta);
  const history = closes.slice(-90).map((v) => +(v * k).toFixed(2));
  const price = +(meta.regularMarketPrice * k);
  const prevClose = +((meta.chartPreviousClose ?? meta.previousClose ?? meta.regularMarketPrice) * k);
  let intraday = [];
  if (intra.status === "fulfilled" && intra.value.closes.length > 1) {
    intraday = intra.value.closes.map((v) => +(v * k).toFixed(2));
  } else {
    intraday = [prevClose, price];
  }
  // keep the live current price as the last point of both series
  if (history.length) history[history.length - 1] = +price.toFixed(2);
  intraday[intraday.length - 1] = +price.toFixed(2);
  return {
    sym: appSym,
    price: +price.toFixed(2),
    prevClose: +prevClose.toFixed(2),
    open: meta.regularMarketOpen != null ? +(meta.regularMarketOpen * k).toFixed(2) : +price.toFixed(2),
    dayHigh: meta.regularMarketDayHigh != null ? +(meta.regularMarketDayHigh * k).toFixed(2) : Math.max(price, ...intraday),
    dayLow: meta.regularMarketDayLow != null ? +(meta.regularMarketDayLow * k).toFixed(2) : Math.min(price, ...intraday),
    cur: curFor(meta),
    history,
    intraday,
  };
}

async function fxUsdZar() {
  try {
    const { meta } = await fetchChart("ZAR=X", "1d", "1d");
    return +meta.regularMarketPrice.toFixed(4);
  } catch (_) {
    return null;
  }
}

// run async jobs with a small concurrency cap (be polite to Yahoo)
async function mapLimited(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); }
      catch (e) { out[idx] = { sym: items[idx], error: e.message }; }
    }
  });
  await Promise.all(workers);
  return out;
}

// --- tiny in-memory cache --------------------------------------------------
const cache = { bootstrap: null, bootstrapAt: 0, quotes: null, quotesAt: 0 };
const BOOT_TTL = 60 * 1000;   // history changes slowly
const QUOTE_TTL = 12 * 1000;  // current prices

async function getBootstrap() {
  if (cache.bootstrap && Date.now() - cache.bootstrapAt < BOOT_TTL) return cache.bootstrap;
  const [rows, usdZar] = await Promise.all([
    mapLimited(ALL_SYMBOLS, 6, bootstrapOne),
    fxUsdZar(),
  ]);
  const stocks = {};
  for (const r of rows) if (r && !r.error) stocks[r.sym] = r;
  const payload = { stocks, usdZar, ts: Date.now(), source: "yahoo" };
  cache.bootstrap = payload;
  cache.bootstrapAt = Date.now();
  return payload;
}

async function getQuotes(symbols) {
  const want = (symbols && symbols.length ? symbols : ALL_SYMBOLS).filter((s) => SYMBOL_MAP[s]);
  if (cache.quotes && Date.now() - cache.quotesAt < QUOTE_TTL) {
    return { quotes: pick(cache.quotes, want), ts: cache.quotesAt };
  }
  const rows = await mapLimited(ALL_SYMBOLS, 6, quoteOne);
  const map = {};
  for (const r of rows) if (r && !r.error) map[r.sym] = r;
  cache.quotes = map;
  cache.quotesAt = Date.now();
  return { quotes: pick(map, want), ts: cache.quotesAt };
}
function pick(map, keys) {
  const o = {};
  for (const k of keys) if (map[k]) o[k] = map[k];
  return o;
}

module.exports = { getBootstrap, getQuotes, fxUsdZar, ALL_SYMBOLS, SYMBOL_MAP };
