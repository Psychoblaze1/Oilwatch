# Lab88 — Oil Analysis Dashboard

Multi-screen LIMS for piston-aircraft oil analysis and SANS 342:2016
diesel-fuel testing. The UI started as a [Claude Design](https://claude.ai/design)
handoff; the server is a thin Node proxy that streams Claude Sonnet
responses to the in-app
AI panel and serves the static prototype.

## Stack

- **Frontend**: React 18 UMD + Babel standalone + JSX modules — no build
  step. The whole UI lives in `public/`. Drop a new design export in and
  reload to update.
- **Backend**: Node 18+ / Express. Two files: `server/index.js` +
  `package.json`. Anthropic API key reads from `.env`.
- **PDF**: jsPDF + html2canvas (CDN) for client-side report download.

## Run locally

```bash
npm install
cp .env.example .env   # paste your real ANTHROPIC_API_KEY
npm start              # → http://localhost:3000
```

## Deploy to AWS (EC2)

1. SCP the repo to the instance, `npm ci --omit=dev`.
2. Create `/home/ec2-user/lab88/.env` containing
   `ANTHROPIC_API_KEY=sk-ant-...` and `PORT=3000`.
3. Run as a systemd service (example unit):

   ```ini
   [Unit]
   Description=Lab88
   After=network.target

   [Service]
   WorkingDirectory=/home/ec2-user/lab88
   ExecStart=/usr/bin/node server/index.js
   EnvironmentFile=/home/ec2-user/lab88/.env
   Restart=on-failure
   User=ec2-user

   [Install]
   WantedBy=multi-user.target
   ```

4. Front it with nginx/ALB and terminate TLS there. The Node process
   itself listens on plain HTTP.

## Features wired

- Light / dark theme toggle in the topbar (persists via localStorage).
- Accent color picker in the Tweaks panel (bottom right) — default is
  burnt orange `#c2410c`.
- Role switcher (TECH / ANALYST / MANAGER / ADMIN) gates kanban actions.
- **PDF export** on Fleet Overview, Sample detail, and Asset drill-down
  via the "Export PDF" / "Report PDF" buttons.
- **CSV export** on Samples and Assets list screens.
- **Alarm acknowledge** on the Alarms screen (individual + Ack-all).
- **Sample lifecycle**: per-card advance buttons in the kanban move
  samples DRAFT → QC → APPROVED → PUBLISHED (gated by role). Bulk QC
  approval from the page header. Approve / Publish / Reject in the
  Sample detail screen header.
- **AI panel** (⌘K): streams responses from Claude Sonnet via
  `/api/analyze`. Context (current route, role, focused asset/sample,
  site filter) is included in the system prompt automatically.

## Dropping in a future design re-export

Every Claude Design handoff is shaped the same way:

```
project/
├── Lab88.html
├── tweaks-panel.jsx
└── src/*.jsx
```

To update the app:

1. Extract the new tarball next to this repo.
2. `rm -rf public/* && cp -r path/to/new-bundle/project/* public/`
3. Reapply the small edits this repo adds on top of the raw design:
   - jsPDF + html2canvas script tags in `Lab88.html`
   - Topbar theme-toggle button in `shell.jsx`
   - Persisted theme + PDF/CSV helpers in `app.jsx`
   - Real fetch in `ai-panel.jsx`
   - Wire any new "Export" / "Approve" buttons to `window.exportPDF` /
     `window.exportCSV`.
4. Reload — no rebuild required.

For larger redesigns, consider keeping the edits as a small patch file.

## Roadmap

These were called out by the user and are intentionally not implemented
yet — the structure is ready for them:

- **Editing limits** — per-asset-class warn/alarm thresholds (new
  `screen-limits.jsx` + a `POST /api/limits` route).
- **Rules engine** — declarative rules that trigger alarms /
  notifications (new `screen-rules.jsx` + `POST /api/rules`).
- **Spectro Scientific auto-upload** — ingest CSV/XML/PDF dumps from
  Spectro instruments (`POST /api/ingest/spectro`, likely with a
  multipart handler).

To add a screen: create `public/src/screen-<name>.jsx`, add a
`<script>` line in `public/Lab88.html`, add a nav entry in
`public/src/shell.jsx`, and a route case in `public/src/app.jsx`.
