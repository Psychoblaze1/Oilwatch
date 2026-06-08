// EasyEquities "cowork" sync — Claude drives a real Chrome to read your holdings.
//
// Model: you log in yourself (so OTP/2FA is handled and no password is stored),
// then Claude takes over the authenticated tab. It uses DOM tools (read the
// page / click / navigate) to find every position across your USD and ZAR
// accounts and writes them to ../server/data/holdings.json, which the dashboard
// loads in place of the sample holdings. Read-only — it never trades.
//
//   cd cowork && npm install && npx playwright install chromium
//   npm run sync
//
// Requires ANTHROPIC_API_KEY (read from the repo-root .env).

const path = require("path");
const fs = require("fs");
const readline = require("readline");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const { chromium } = require("playwright");
const Anthropic = require("@anthropic-ai/sdk");

const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const LOGIN_URL = process.env.EE_URL || "https://platform.easyequities.io/";
const OUT = path.resolve(__dirname, "..", "server", "data", "holdings.json");
const MAX_STEPS = 30;

if (!API_KEY) {
  console.error("✗ ANTHROPIC_API_KEY is not set (put it in the repo-root .env).");
  process.exit(1);
}
const client = new Anthropic({ apiKey: API_KEY });

/* ----------------------------- browser tools ----------------------------- */
// A compact snapshot of the page: enough for Claude to navigate + read, small
// enough to keep token use sane.
async function snapshot(page) {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const data = await page.evaluate(() => {
    const clip = (s, n) => (s || "").replace(/\s+/g, " ").trim().slice(0, n);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && st.visibility !== "hidden" && st.display !== "none";
    };
    const links = [...document.querySelectorAll("a")]
      .filter(visible).map((a) => clip(a.innerText, 60)).filter(Boolean);
    const buttons = [...document.querySelectorAll("button,[role=button],input[type=submit],[role=tab]")]
      .filter(visible).map((b) => clip(b.innerText || b.value, 60)).filter(Boolean);
    return {
      title: document.title,
      text: clip(document.body ? document.body.innerText : "", 9000),
      links: [...new Set(links)].slice(0, 120),
      buttons: [...new Set(buttons)].slice(0, 80),
    };
  });
  return { url: page.url(), ...data };
}

async function clickText(page, text) {
  const tries = [
    page.getByRole("link", { name: text, exact: false }),
    page.getByRole("button", { name: text, exact: false }),
    page.getByRole("tab", { name: text, exact: false }),
    page.getByText(text, { exact: false }),
  ];
  for (const loc of tries) {
    const el = loc.first();
    if (await el.count().catch(() => 0)) {
      try {
        await el.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
        await el.click({ timeout: 6000 });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        return { ok: true };
      } catch (_) { /* try next strategy */ }
    }
  }
  return { ok: false, error: `No clickable element matching "${text}".` };
}

const TOOLS = [
  { name: "read_page", description: "Read the current page. Returns the URL, title, visible text, and the visible link/button/tab labels you can click_text.",
    input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "navigate", description: "Go to a URL within EasyEquities.",
    input_schema: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false } },
  { name: "click_text", description: "Click the first visible link/button/tab whose label contains this text (e.g. an account name, 'My Investments', 'Holdings').",
    input_schema: { type: "object", properties: { text: { type: "string" } }, required: ["text"], additionalProperties: false } },
  { name: "report_holdings", description: "Report every holding you found across all accounts, then finish.",
    input_schema: { type: "object", additionalProperties: false, required: ["holdings"], properties: {
      holdings: { type: "array", items: { type: "object", additionalProperties: false,
        required: ["symbol", "shares", "account", "currency"],
        properties: {
          symbol: { type: "string", description: "Standard ticker — US like NVDA/AMD/PLTR, JSE like NPN/PRX/STXNDQ/STX500." },
          name: { type: "string" },
          shares: { type: "number", description: "Quantity of shares / units held." },
          avgPrice: { type: "number", description: "Average purchase price in the position's own currency." },
          account: { type: "string", description: "Which EasyEquities account, e.g. 'USD', 'ZAR', 'TFSA'." },
          currency: { type: "string", enum: ["USD", "ZAR"] },
        } } },
      notes: { type: "string", description: "Anything notable (accounts you couldn't open, values you were unsure about)." },
    } } },
];

const SYSTEM = [
  "You are a careful, read-only browser agent reading the user's OWN EasyEquities portfolio. The user has already logged in for you.",
  "Goal: find EVERY holding across ALL of their accounts (e.g. the USD wallet and the ZAR / TFSA wallets) and report them with report_holdings.",
  "Method: call read_page to see where you are. Use click_text to open the investments/holdings area and to switch between accounts (the account switcher usually shows the account name or currency). Use navigate only if you know a URL.",
  "For each position capture: the standard ticker symbol, the instrument name, the quantity of shares/units, the average purchase price (in that position's own currency), and which account/currency it sits in.",
  "Map instrument names to standard tickers (e.g. 'NVIDIA' → NVDA, 'Naspers' → NPN, 'Satrix Nasdaq 100' → STXNDQ).",
  "Be thorough: make sure you've opened each account before reporting. When you have them all, call report_holdings exactly once.",
  "STRICT: read-only. Never click buy/sell, never place an order, never change settings. If you can't find holdings, report_holdings with an empty list and an explanatory note.",
].join("\n");

/* ----------------------------- the agent loop ---------------------------- */
async function runAgent(page) {
  const messages = [{
    role: "user",
    content: "I'm logged in to EasyEquities. Read my holdings across all my accounts and report them.",
  }];

  for (let step = 0; step < MAX_STEPS; step++) {
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools: TOOLS,
      messages,
    });
    messages.push({ role: "assistant", content: resp.content });

    // surface any narration
    for (const b of resp.content) {
      if (b.type === "text" && b.text.trim()) console.log("  ↳ " + b.text.trim());
    }

    const toolUses = resp.content.filter((b) => b.type === "tool_use");
    if (resp.stop_reason !== "tool_use" || toolUses.length === 0) {
      console.log("  (model stopped without reporting holdings)");
      return null;
    }

    const results = [];
    for (const tu of toolUses) {
      if (tu.name === "report_holdings") {
        results.push({ type: "tool_result", tool_use_id: tu.id, content: "Holdings recorded. Done." });
        // flush remaining tool_results before returning
        messages.push({ role: "user", content: results });
        return tu.input;
      }
      let out;
      try {
        if (tu.name === "navigate") { await page.goto(tu.input.url, { waitUntil: "domcontentloaded", timeout: 30000 }); out = await snapshot(page); }
        else if (tu.name === "read_page") out = await snapshot(page);
        else if (tu.name === "click_text") { const r = await clickText(page, tu.input.text); out = { ...r, ...(await snapshot(page)) }; }
        else out = { error: "unknown tool" };
      } catch (e) {
        out = { error: e.message, ...(await snapshot(page).catch(() => ({}))) };
      }
      const where = tu.name === "navigate" ? tu.input.url : tu.name === "click_text" ? `"${tu.input.text}"` : "";
      console.log(`  • ${tu.name} ${where}`.trim());
      results.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: "user", content: results });
  }
  console.log("  (hit step limit without a report)");
  return null;
}

/* ----------------------------- holdings → file --------------------------- */
function writeHoldings(report) {
  const rows = (report.holdings || [])
    .filter((h) => h && h.symbol && h.shares)
    .map((h) => ({
      sym: String(h.symbol).toUpperCase().trim(),
      name: h.name || h.symbol,
      shares: +h.shares,
      avg: h.avgPrice != null ? +h.avgPrice : null,
      acct: /zar|tfsa|rand/i.test(h.account || "") || h.currency === "ZAR" ? "ZAR" : "USD",
      currency: h.currency === "ZAR" ? "ZAR" : "USD",
    }));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({
    syncedAt: new Date().toISOString(),
    source: "easyequities",
    notes: report.notes || null,
    holdings: rows,
  }, null, 2));
  return rows;
}

/* --------------------------------- main ---------------------------------- */
async function main() {
  console.log("Launching Chrome…");
  const browser = await chromium.launch({ headless: false, channel: process.env.EE_CHANNEL || undefined });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" }).catch(() => {});

  console.log("\n────────────────────────────────────────────────────────────");
  console.log(" 1. Log in to EasyEquities in the Chrome window (do any OTP).");
  console.log(" 2. When you can see your portfolio, come back here and press Enter.");
  console.log("────────────────────────────────────────────────────────────\n");
  await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question("Press Enter once you're logged in… ", () => { rl.close(); resolve(); });
  });

  console.log("\nClaude is reading your holdings…\n");
  let report = null;
  try {
    report = await runAgent(page);
  } catch (e) {
    console.error("\n✗ Agent error:", e.message);
  }
  await browser.close();

  if (!report) { console.error("\n✗ No holdings were extracted. Try again, or open the holdings page before pressing Enter."); process.exit(1); }
  const rows = writeHoldings(report);
  console.log(`\n✓ Synced ${rows.length} holdings → ${path.relative(process.cwd(), OUT)}`);
  for (const r of rows) console.log(`   ${r.sym.padEnd(8)} ${String(r.shares).padStart(8)}  @ ${r.avg ?? "?"} ${r.currency}  (${r.acct})`);
  if (report.notes) console.log("\n   notes: " + report.notes);
  console.log("\nRestart / refresh the dashboard — your real holdings are now loaded.");
}

main().catch((e) => { console.error(e); process.exit(1); });
