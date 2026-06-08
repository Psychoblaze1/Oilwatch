# Atomic Capital — AI Stock Tracker

A live, dark, desktop dashboard for tracking an **EasyEquities** portfolio and the
stocks worth watching in the **AI · quantum · computing** space — with a
**Claude-powered investment co-pilot** that tells you *when* to invest and why.

The UI is a [Claude Design](https://claude.ai/design) handoff ("Atomic Capital",
built on the Atomic Oil design system); the server is a thin Node proxy that
streams Claude responses to the in-app AI and serves the static prototype.

## What's in it

- **Portfolio** — blended-Rand total with USD + ZAR (EasyEquities-style)
  sub-accounts, live-ticking prices that flash green/red, a 90-day performance
  chart, sector allocation, and a risk-aware balance / concentration check.
- **Watchlist** — AI / quantum / computing cards with sparklines, signal chips
  and sector filters.
- **AI signals** — buy / sell / hold cards with **"when to invest" timing**,
  plain-English reasoning, confidence meters, drivers, and model targets.
- **Market pulse** — live sector heat tiles (AI · Quantum · Computing · Broad/SA)
  and the biggest movers.
- **Stock detail** — interactive chart (1D–3M), key stats, news with sentiment,
  your position, and a **live AI take** (see below).
- **Risk dial** (Cautious / Balanced / Bold) in the top bar re-tunes the AI's
  tone and targets in real time.

## The AI (Claude)

Two surfaces call the real model — both stream, both are **portfolio-, risk- and
EasyEquities-aware**, and both can use **web search** to pull current news and
prices and cite their sources:

- **Ask AI** (top bar, or `⌘K`) — a co-pilot drawer. It sees your live holdings,
  watchlist, buying power and risk dial, so you can ask things like *"is my book
  too concentrated?"*, *"when should I add to NVDA?"*, or *"summarise today's AI
  & quantum news."*
- **Live AI take** (stock detail) — an on-demand, web-aware read on a single
  ticker: buy / hold / sell / avoid, with concrete levels and timing.

The dashboard itself stays instant — the model is called on demand, not on every
navigation.

### Where the AI lives in the code

- `server/index.js` → `POST /api/ai` streams the Claude Messages API (official
  `@anthropic-ai/sdk`) back to the browser as SSE. The system prompt is built per
  request from the portfolio snapshot + risk appetite the client sends.
- `public/ai.jsx` → the browser side: `streamAI()`, the `<AIAssistant>` drawer,
  and `<LiveAITake>`.

## Run locally

```bash
npm install
cp .env.example .env    # paste your real ANTHROPIC_API_KEY
npm start               # → http://localhost:3000
```

Config (`.env`):

| Var | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | required for the AI |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8` | any current Claude model |
| `WEB_SEARCH`        | `on` | `off` disables live news/price lookups |
| `PORT`              | `3000` | |

Without a key the dashboard still runs fully (live mock data); only the AI
surfaces report that the key is missing.

## Stack

- **Frontend**: React 18 UMD + Babel standalone + JSX modules — no build step.
  The whole UI lives in `public/`. `public/data.js` paints instantly from a small
  synthetic seed, then **hydrates with real prices** from the server and polls for
  live updates (`startFeed()`); if the feed is unreachable it falls back to the
  seed so the app still works offline.
- **Backend**: Node 18+ / Express + the Anthropic SDK.
  - `server/quotes.js` proxies **real market data** from Yahoo Finance (no API
    key): live price, 90-day history and intraday for every ticker. JSE shares
    (quoted in cents) are converted to Rand, and USD/ZAR is fetched live.
  - `server/index.js` serves the app and the `/api/ai`, `/api/bootstrap` and
    `/api/quotes` routes. The Anthropic key is read from `.env` and never reaches
    the browser.

## Deploy (EC2 example)

1. SCP the repo to the instance, `npm ci --omit=dev`.
2. Create `.env` with `ANTHROPIC_API_KEY=sk-ant-...` and `PORT=3000`.
3. Run as a systemd service:

   ```ini
   [Unit]
   Description=Atomic Capital
   After=network.target

   [Service]
   WorkingDirectory=/home/ec2-user/atomic-capital
   ExecStart=/usr/bin/node server/index.js
   EnvironmentFile=/home/ec2-user/atomic-capital/.env
   Restart=on-failure
   User=ec2-user

   [Install]
   WantedBy=multi-user.target
   ```

4. Front it with nginx/ALB and terminate TLS there.

## EasyEquities sync — Claude reads your real holdings (cowork)

`cowork/` is a small **local** tool where **Claude drives a real Chrome** to pull
your actual EasyEquities holdings into the dashboard. You log in yourself (so
OTP/2FA works and **no password is stored**); Claude then takes over the
authenticated tab, reads every position across your USD and ZAR accounts using
DOM tools (read page / click / navigate — there is no "buy" tool, it's
read-only), and writes them to `server/data/holdings.json`. The dashboard loads
that in place of the sample holdings, and the sidebar flips to "synced".

```bash
cd cowork
npm install
npx playwright install chromium   # one-time
npm run sync                       # opens Chrome → you log in → press Enter
```

See `cowork/README.md` for details. `server/data/holdings.json` is your personal
data and is git-ignored.

## Data: what's real

- **Prices, history, FX — real.** Every quote, 90-day chart and the USD/ZAR rate
  come live from Yahoo Finance via `server/quotes.js`.
- **Holdings — your real positions, once synced.** EasyEquities has no public
  trading API, so the *holdings* (which shares, how many, average cost) start as
  a realistic sample. `AtomicData.setHoldings()` swaps in a real set; the
  EasyEquities browser sync (below) populates it for real, after which the AI is
  genuinely "checking your account."

> AI output is research and education, **not** regulated financial advice. Verify
> before you trade.
