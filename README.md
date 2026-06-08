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
  The whole UI lives in `public/`. Market data is mocked in `public/data.js`,
  shaped like a real quote feed (`startFeed()`) so a websocket / REST source can
  drop in later without touching the views.
- **Backend**: Node 18+ / Express. One file (`server/index.js`) + the Anthropic
  SDK. The API key is read from `.env` and never reaches the browser.

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

## On the EasyEquities data

EasyEquities has **no public trading API**, so a prototype can't pull your real
holdings live. The portfolio is realistic **mock data** in `public/data.js`,
modelled on EasyEquities' USD + ZAR sub-account structure. The AI reasons over
whatever is in that snapshot — so once a real feed (or a manual holdings import)
populates it, the co-pilot is "checking your account" for real with no other
changes. Wiring a live feed / import is the natural next step.

> AI output is research and education, **not** regulated financial advice. Verify
> before you trade.
