# cowork — EasyEquities holdings sync

Claude drives a **real Chrome** to read your EasyEquities portfolio into Atomic
Capital. You log in yourself (so OTP/2FA just works and **no password is ever
stored**); Claude then takes over the authenticated tab, reads every position
across your USD and ZAR accounts, and writes them to
`../server/data/holdings.json`, which the dashboard loads in place of the sample
holdings.

**Read-only.** The agent is instructed never to trade or change settings, and is
only given navigate / read / click tools — there is no "buy" tool.

## Run it (on your own machine)

```bash
# from the repo root, make sure .env has ANTHROPIC_API_KEY
cd cowork
npm install
npx playwright install chromium   # one-time: download the browser
npm run sync
```

Then:

1. A Chrome window opens on EasyEquities. **Log in** (complete any OTP) and open
   your portfolio.
2. Switch back to the terminal and **press Enter**.
3. Claude reads your holdings and prints what it found.
4. Refresh the dashboard — your real positions are now loaded.

## Config (repo-root `.env`)

| Var | Default | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | — | required |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8` | model that drives the browser |
| `EE_URL`            | `https://platform.easyequities.io/` | login/start page |
| `EE_CHANNEL`        | — | set to `chrome` to use your installed Chrome instead of the bundled Chromium |

## Notes & limits

- Only tickers the dashboard already tracks render in the portfolio view. If you
  hold something outside the AI/quantum/computing universe, add it in two places:
  `public/data.js` (`DEF` list) and `server/quotes.js` (`SYMBOL_MAP`). The raw
  sync still saves everything to `holdings.json`.
- `holdings.json` is your personal financial data — it is **git-ignored** and
  stays on your machine.
- EasyEquities changes its site and has bot protection; if a run comes up empty,
  open the holdings page yourself *before* pressing Enter, then re-run. The agent
  adapts to what it can see on the page.
