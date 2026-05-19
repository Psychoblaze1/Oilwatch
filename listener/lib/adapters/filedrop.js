// File-drop adapter — watches a directory for new CSV/TSV/TXT files
// dropped by an instrument's "export" routine. When a stable file
// arrives we read its contents, detect the instrument format via
// `detectAndParse`, and enqueue a draft sample for upload.
//
// Stability is enforced by chokidar's `awaitWriteFinish` so we don't
// pick up half-written files mid-export.

const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");

const { detectAndParse } = require("../parsers");
const queue   = require("../queue");

function start(instrument, { onActivity }) {
  const dir = instrument.watchPath;
  if (!dir || !fs.existsSync(dir)) {
    return { stop() {}, error: `watch path missing: ${dir || "(unset)"}` };
  }
  const watcher = chokidar.watch(dir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 200 },
    persistent: true,
    depth: 0,
  });

  watcher.on("add", async (file) => {
    try {
      const stat = fs.statSync(file);
      if (!stat.isFile()) return;
      if (stat.size > 10 * 1024 * 1024) {
        onActivity({ level: "warn", instrumentId: instrument.id,
                     text: `skipping ${path.basename(file)} — over 10 MB` });
        return;
      }
      const text = fs.readFileSync(file, "utf8");
      const { kind, readings } = detectAndParse(path.basename(file), text);
      if (!readings.length) {
        onActivity({ level: "warn", instrumentId: instrument.id,
                     text: `${path.basename(file)} → no recognisable readings (kind: ${kind})` });
        return;
      }
      const dataUrl = `data:text/csv;base64,${Buffer.from(text, "utf8").toString("base64")}`;
      const payload = {
        assetId: instrument.assetId || null,
        component: "Auto (instrument upload)",
        receivedAt: new Date().toISOString(),
        status: "DRAFT",
        priority: "STD",
        analyst: `Listener · ${instrument.name}`,
        sampleType: instrument.sampleType || "diesel-cf1",
        results: readings,
        note: `Auto-imported from ${instrument.name} (${kind}); source file: ${path.basename(file)}`,
        // Stash the raw file under the matching file slot.
        irVisionFile:   kind === "ir-vision"   ? dataUrl : null,
        flashPointFile: kind === "flash-point" ? dataUrl : null,
        additivesFile:  kind === "additives"   ? dataUrl : null,
      };
      queue.enqueue({ payload, source: instrument.id });
      onActivity({
        level: "info", instrumentId: instrument.id,
        text: `${path.basename(file)} → ${kind}: ${readings.length} readings · queued for upload`,
      });
    } catch (e) {
      onActivity({ level: "error", instrumentId: instrument.id,
                   text: `${path.basename(file)} failed: ${e.message}` });
    }
  });

  watcher.on("error", (e) => {
    onActivity({ level: "error", instrumentId: instrument.id, text: "watcher: " + e.message });
  });

  return {
    stop() { watcher.close().catch(() => {}); },
    info() { return { watching: dir }; },
  };
}

module.exports = { start };
