// Serial adapter (stub). Implement once `serialport` is installed.
// Same contract as filedrop: returns { stop, info } and calls
// onActivity for log lines.
//
// Recommended frame: newline-delimited CSV from the instrument. Each
// frame is parsed via parsers.detectAndParse() with a synthetic
// filename hint matching the instrument's kind (e.g. "ir-vision").

const { detectAndParse } = require("../parsers");
const queue = require("../queue");

let SerialPortMod = null;
try { SerialPortMod = require("serialport"); } catch (_) { /* not installed */ }

function start(instrument, { onActivity }) {
  if (!SerialPortMod) {
    return {
      stop() {},
      error: "serialport not installed — `npm install serialport` in listener/ to enable serial adapters.",
    };
  }
  const { SerialPort } = SerialPortMod;
  const { ReadlineParser } = require("@serialport/parser-readline");

  const port = new SerialPort({
    path: instrument.serialPort,
    baudRate: instrument.baudRate || 9600,
    autoOpen: true,
  });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));

  let buf = "";
  let frameTimer = null;
  const flush = () => {
    if (!buf.trim()) return;
    const text = buf; buf = "";
    try {
      const { kind, readings } = detectAndParse(instrument.name + ".csv", text);
      if (!readings.length) {
        onActivity({ level: "warn", instrumentId: instrument.id, text: `frame produced no readings (kind: ${kind})` });
        return;
      }
      queue.enqueue({
        payload: {
          assetId: instrument.assetId || null,
          component: "Auto (instrument upload)",
          receivedAt: new Date().toISOString(),
          status: "DRAFT", priority: "STD",
          analyst: `Listener · ${instrument.name}`,
          sampleType: instrument.sampleType || "diesel-cf1",
          results: readings,
          note: `Auto-imported from ${instrument.name} (serial · ${kind})`,
        },
        source: instrument.id,
      });
      onActivity({ level: "info", instrumentId: instrument.id, text: `serial frame → ${readings.length} readings` });
    } catch (e) {
      onActivity({ level: "error", instrumentId: instrument.id, text: e.message });
    }
  };

  parser.on("data", (line) => {
    buf += line + "\n";
    clearTimeout(frameTimer);
    // Assume the instrument emits a blank line between sample frames;
    // if not, the 750ms idle timer commits whatever's buffered.
    frameTimer = setTimeout(flush, 750);
  });
  port.on("open",  () => onActivity({ level: "info",  instrumentId: instrument.id, text: `serial open ${instrument.serialPort}@${instrument.baudRate || 9600}` }));
  port.on("error", (e) => onActivity({ level: "error", instrumentId: instrument.id, text: "serial: " + e.message }));
  port.on("close", () => onActivity({ level: "warn",  instrumentId: instrument.id, text: "serial closed" }));

  return {
    stop() { try { port.close(); } catch (_) {} clearTimeout(frameTimer); },
    info() { return { port: instrument.serialPort, baudRate: instrument.baudRate || 9600 }; },
  };
}

module.exports = { start };
