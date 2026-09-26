import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Source block ${start} was not found`);
  return html.slice(from, to);
}

const context = vm.createContext({ Set, String, Number, Array, Math });
vm.runInContext(`
  var alfanoDataSanitized = false;
  function trackRecordKey(track) {
    return String(track || "Trať").trim().toLocaleUpperCase("cs-CZ");
  }
  ${sourceBetween("      function median", "      function telemetryLapIsAnalyzable")}
`, context);

const lapTimes = [63720, 58850, 58480, 60160, 57870, 57800, 57850, 57880, 58050, 60510, 56690, 58160, 58500, 58830];
function targetSession(overrides = {}) {
  return {
    fileName: "ALFANO7_LAP_SN4006_260926_17H46_JJ_HRADISTE_14_5669.zip",
    driver: "JJ",
    track: "HRADISTE",
    date: "26-09-2026",
    time: "17:46",
    laps: lapTimes.map((ms, index) => ({ lap: index + 1, ms, maxSpeed: 90 + index / 10, maxRpm: 7000 + index })),
    gpsLaps: lapTimes.map((ms, index) => ({ lap: index + 1, ms, points: [[0, 0], [1, 1]] })),
    virtualSectors: lapTimes.map((ms, index) => ({ lap: index + 1, ms })),
    ...overrides
  };
}

const cleaned = targetSession();
context.normalizeAlfanoSession(cleaned);
assert.equal(cleaned.laps.length, 13);
assert.equal(cleaned.gpsLaps.length, 13);
assert.equal(cleaned.virtualSectors.length, 13);
assert.ok(!cleaned.laps.some((lap) => lap.lap === 11));
assert.ok(!cleaned.gpsLaps.some((lap) => lap.lap === 11));
assert.ok(!cleaned.virtualSectors.some((sector) => sector.lap === 11));
assert.equal(cleaned.bestMs, 57800);
assert.equal(cleaned.bestLap, 6);
assert.equal(context.alfanoDataSanitized, true);

const otherDriver = targetSession({ driver: "Tomáš" });
context.normalizeAlfanoSession(otherDriver);
assert.equal(otherDriver.laps.length, 14);
assert.equal(otherDriver.bestMs, 56690);

const otherSession = targetSession({ time: "17:47" });
context.normalizeAlfanoSession(otherSession);
assert.equal(otherSession.laps.length, 14);
assert.equal(otherSession.bestMs, 56690);

console.log("Known invalid lap removed only from JJ · HRADISTE · 26-09-2026 17:46; valid best 57.800 s");
