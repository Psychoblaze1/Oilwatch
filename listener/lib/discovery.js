// Auto-discovery for instruments.
//
// Two layers:
//   1. Default Inbox — ensures `~/Lab88/Incoming` exists and, if no
//      filedrop instrument is configured yet, registers one watching
//      that path. Result: drop any IR Vision / Flash Point / Additives
//      CSV in the folder and it gets parsed + uploaded with zero setup.
//   2. Serial scan — polls `SerialPort.list()` every few seconds and
//      surfaces candidates (manufacturer, vid:pid, path) in the
//      snapshot so the renderer can offer a one-click Adopt button.
//      Already-adopted ports are filtered out.
//
// No serial port is auto-adopted: a USB-serial cable could be anything
// (printer, GPS, dongle). The user confirms each one. The inbox folder
// is auto-adopted because creating an empty directory is harmless.

const fs = require("fs");
const os = require("os");
const path = require("path");

const config = require("./config");

let SerialPortMod = null;
try { SerialPortMod = require("serialport"); } catch (_) {}

let pollTimer = null;
let onActivity = () => {};
let onChange = () => {};
const state = {
  inboxPath: null,
  serial: [],          // [{ path, manufacturer, vendorId, productId, serialNumber, signature }]
  lastScanAt: 0,
  serialSupported: !!SerialPortMod,
};

// Rough signature table — matches a port's manufacturer / vid:pid
// against known oil-lab instruments. Unknown ports still surface as
// candidates; they just don't get a hint.
const SIGNATURES = [
  { match: /spectro/i,           hint: "Spectro Inc — likely FluidScan / MiniVisc / Spectroil" },
  { match: /ftdi/i,              hint: "FTDI USB-serial — common on lab instruments" },
  { match: /prolific|pl2303/i,   hint: "Prolific USB-serial bridge" },
  { match: /silicon labs|cp210/i, hint: "Silicon Labs CP210x — common on lab instruments" },
];
function signatureFor(p) {
  const blob = [p.manufacturer, p.vendorId, p.productId, p.pnpId].filter(Boolean).join(" ");
  for (const s of SIGNATURES) if (s.match.test(blob)) return s.hint;
  return null;
}

function ensureInbox() {
  const inbox = path.join(os.homedir(), "Lab88", "Incoming");
  try {
    fs.mkdirSync(inbox, { recursive: true });
    state.inboxPath = inbox;
  } catch (e) {
    onActivity({ level: "warn", text: `couldn't create inbox at ${inbox}: ${e.message}` });
    return null;
  }
  // Auto-register a filedrop instrument for the inbox if none exists
  // for that path yet. (User can delete it from the UI to opt out;
  // the path is persisted so they won't get re-added on next launch
  // unless they also remove the path from disk… simplest: we just
  // never re-add if it's already there or any other filedrop exists.)
  const existing = config.get().instruments;
  const already = existing.some(i => i.transport === "filedrop" && i.watchPath === inbox);
  const anyFiledrop = existing.some(i => i.transport === "filedrop");
  if (!already && !anyFiledrop) {
    const ins = config.addInstrument({
      name: "Inbox (auto)",
      transport: "filedrop",
      watchPath: inbox,
      sampleType: "diesel-cf1",
      auto: true,
    });
    onActivity({ level: "info", instrumentId: ins.id, text: `auto-registered Inbox watcher at ${inbox}` });
    return ins;
  }
  return null;
}

async function scanSerial() {
  if (!SerialPortMod) return;
  try {
    const { SerialPort } = SerialPortMod;
    const ports = await SerialPort.list();
    const adopted = new Set(config.get().instruments.filter(i => i.transport === "serial").map(i => i.serialPort));
    state.serial = ports
      .filter(p => p.path && !adopted.has(p.path))
      .map(p => ({
        path: p.path,
        manufacturer: p.manufacturer || null,
        vendorId: p.vendorId || null,
        productId: p.productId || null,
        serialNumber: p.serialNumber || null,
        signature: signatureFor(p),
      }));
    state.lastScanAt = Date.now();
    onChange();
  } catch (e) {
    onActivity({ level: "warn", text: "serial scan failed: " + e.message });
  }
}

function start(opts = {}) {
  onActivity = opts.onActivity || (() => {});
  onChange   = opts.onChange   || (() => {});

  // Inbox: register the auto-watched folder on first boot.
  const inbox = ensureInbox();

  // Serial scan: now and every 5s.
  scanSerial();
  pollTimer = setInterval(scanSerial, 5000);

  return inbox;
}

function stop() {
  clearInterval(pollTimer);
  pollTimer = null;
}

function snapshot() {
  return {
    inboxPath: state.inboxPath,
    serialSupported: state.serialSupported,
    serial: state.serial,
    lastScanAt: state.lastScanAt,
  };
}

function adoptSerial(portPath, extra = {}) {
  const cand = state.serial.find(p => p.path === portPath);
  const name = extra.name
    || (cand && cand.signature && cand.manufacturer ? `${cand.manufacturer} (${portPath})` : portPath);
  const ins = config.addInstrument({
    name,
    transport: "serial",
    serialPort: portPath,
    baudRate: extra.baudRate || 9600,
    sampleType: extra.sampleType || "diesel-cf1",
    assetId: extra.assetId || "",
  });
  // Hide it from the discovery list immediately.
  state.serial = state.serial.filter(p => p.path !== portPath);
  onChange();
  return ins;
}

module.exports = { start, stop, snapshot, scanSerial, adoptSerial };
