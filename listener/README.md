# Lab88 Listener

A small Electron desktop app that **runs on a lab tech's machine**,
listens to instruments (file drops, serial RS-232, or TCP), parses
their output, and uploads each set of readings to the **Lab88 server**
as a **DRAFT sample** ready for the analyst to review.

The listener is intentionally separate from the main Lab88 server:
it can run on the lab floor while the Lab88 server sits on an internal
network or in AWS. Every upload is queued locally — if the server is
unreachable, the listener keeps trying with exponential backoff until
it gets through.

```
┌─────────────┐    file / serial / TCP    ┌──────────────────────┐
│ Instrument  │ ───────────────────────►  │ Lab88 Listener       │
│ (FluidScan, │                           │  - parses readings   │
│  MiniVisc,  │                           │  - queues upload     │
│  Spectroil) │                           │  - POSTs /api/samples│
└─────────────┘                           └──────────┬───────────┘
                                                     │ HTTP (DRAFT)
                                                     ▼
                                          ┌──────────────────────┐
                                          │ Lab88 server (this   │
                                          │ repo's `/server`)    │
                                          └──────────────────────┘
```

## Run

```bash
cd listener
npm install
npm start
```

A single window opens with three sections:

1. **Lab88 Server** — set the URL to your Lab88 install (default
   `http://localhost:3000`). Optional API key for future auth.
2. **Instruments** — add one entry per instrument. Pick a transport
   (file drop / serial / TCP), give it a watch path / COM port /
   TCP port. Optional **Engine ID** binds every reading to a specific
   piece of equipment in Lab88; leave it blank and the sample arrives
   in Lab88 as a draft with no engine attached for the analyst to
   link.
3. **Upload queue + activity log** — every parsed reading shows up
   here. Successful uploads disappear; failed ones retry on a
   2s → 4s → 8s → … (capped at 5 min) backoff schedule.

## Auto-discovery

On first launch the listener:

- creates `~/Lab88/Incoming` and starts watching it as a file-drop
  instrument named **Inbox (auto)** — drop any IR Vision / Flash Point /
  Additives / Filter Patch file in there and it gets parsed and
  uploaded with zero configuration;
- polls the OS every 5 s for USB-serial ports and surfaces any
  unadopted ones under **Auto-Discovery** with their manufacturer +
  VID:PID. Click **Adopt** to register the port as a serial
  instrument. Known signatures (FTDI, Silicon Labs CP210x, Spectro Inc,
  Prolific) get a hint about the likely device.

Serial discovery needs the optional `serialport` dep; without it the
inbox + manual Add-Instrument forms still work.

## Transports

### File drop

Drop CSV / TSV / TXT files into a watched directory. The parser
auto-detects the instrument kind from the filename:

| filename matches      | kind          | extracted readings                        |
| --------------------- | ------------- | ----------------------------------------- |
| `ir-vision`, `distill`, `spectrovisc`, `minivisc` | IR Vision   | distillation T-points, density, cetane, CFPP, kinematic viscosity |
| `flash`               | Flash Point   | FlashPt                                   |
| `additive`, `spectroil`, `elemental`, `wear`      | Additives   | El_Fe / El_Al / El_Mg / El_Zn / El_Pb / El_Si / El_Mn / El_V / El_Sulphur |

CSV/TSV/semicolon-delimited input all work. The original file is
attached to the uploaded sample (data URL) so the analyst can
re-process if needed.

### Serial

Requires `npm install serialport` (it's listed as an optional
dependency because the native build is platform-sensitive). Frames
are newline-delimited; the parser commits whatever's buffered after
~750 ms of silence.

### TCP

The listener opens a server socket on `host:port`. Instruments push
frames to it terminated by a blank line. Same parser path as file
drop.

## Wiring it to Lab88

The listener posts to `POST /api/samples` on the Lab88 server with
`status: "DRAFT"`. As of commit `…`, that endpoint accepts samples
*without* an `assetId` — those land in the Samples list as orphan
drafts that an analyst attaches to equipment from the Lab88 UI.

If you do bind an Engine ID on the instrument config, the sample
arrives in Lab88 already linked to that piece of equipment.

## Where things live on disk

The listener stores its state under Electron's `userData` directory:

- `listener.config.json` — server URL + instrument list (auto-saved)
- `listener.queue.json` — pending uploads (auto-saved)

Delete those files to reset.

## Adding a new instrument plugin

1. Add the parser to `lib/parsers.js` (or extend an existing one).
2. Teach `detectAndParse(filename, text)` how to recognise the
   instrument's output (filename pattern or column header).
3. That's it — the file-drop / serial / TCP adapters all funnel
   through `detectAndParse`, so any new format becomes available
   on every transport.

Optional: if the instrument speaks a non-CSV protocol, drop a new
adapter into `lib/adapters/` next to `filedrop.js` / `serial.js` /
`tcp.js`. Each adapter exports `start(instrument, { onActivity })`
returning `{ stop, info? }`.
