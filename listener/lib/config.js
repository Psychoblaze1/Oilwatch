// Persisted listener config. Lives as a JSON file in Electron's
// userData directory so it survives restarts. Schema:
//   {
//     serverUrl: "http://localhost:3000",
//     apiKey: "...",                       // optional (future auth)
//     instruments: [{
//       id: "ir-vision-1",
//       name: "FluidScan Q1100 #1",
//       transport: "filedrop" | "serial" | "tcp",
//       watchPath?: "/var/spool/lab88/fluidscan",   // filedrop
//       serialPort?: "COM3",                         // serial
//       baudRate?: 9600,
//       tcpHost?: "0.0.0.0", tcpPort?: 8010,         // tcp
//       assetId?: "A-...",                           // optional: bind to a fixed engine
//       sampleType: "diesel-cf1",
//     }],
//   }

const fs = require("fs");
const path = require("path");

let configPath = null;
let cache = null;

const DEFAULTS = {
  serverUrl: "http://localhost:3000",
  apiKey: "",
  instruments: [],
};

function init(userDataDir) {
  configPath = path.join(userDataDir, "listener.config.json");
  if (fs.existsSync(configPath)) {
    try { cache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configPath, "utf8")) }; }
    catch (e) { console.error("Bad config file, resetting:", e.message); cache = { ...DEFAULTS }; }
  } else {
    cache = { ...DEFAULTS };
    save();
  }
  return cache;
}

function get() { return cache; }

function save() {
  if (!configPath) return;
  fs.writeFileSync(configPath, JSON.stringify(cache, null, 2));
}

function setServer({ serverUrl, apiKey }) {
  if (serverUrl != null) cache.serverUrl = serverUrl.trim() || DEFAULTS.serverUrl;
  if (apiKey    != null) cache.apiKey    = apiKey.trim();
  save();
}

function uid() {
  return "ins_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
}

function addInstrument(spec) {
  const ins = { id: uid(), ...spec };
  cache.instruments.push(ins);
  save();
  return ins;
}
function updateInstrument(id, patch) {
  const i = cache.instruments.findIndex(x => x.id === id);
  if (i >= 0) { cache.instruments[i] = { ...cache.instruments[i], ...patch }; save(); }
  return cache.instruments[i];
}
function removeInstrument(id) {
  cache.instruments = cache.instruments.filter(x => x.id !== id);
  save();
}

module.exports = { init, get, setServer, addInstrument, updateInstrument, removeInstrument };
