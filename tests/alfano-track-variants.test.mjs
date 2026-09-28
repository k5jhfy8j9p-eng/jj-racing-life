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

const context = vm.createContext({ Set, Map, String, Number, Array, Math });
vm.runInContext(`
  var alfanoSessions = [];
  var alfanoDataSanitized = false;
  function hasTelemetry(lap) { return lap && Array.isArray(lap.points) && lap.points.length > 100; }
  function alfanoSessionIsValid(session) {
    return session && session.fileName && Array.isArray(session.laps) && session.laps.length > 0 && Number.isFinite(session.bestMs);
  }
  ${sourceBetween("      function pilotKey", "      function pilotSessions")}
  ${sourceBetween("      function trackRecordKey", "      function trackMapBackground")}
  ${sourceBetween("      function gpsPathDistance", "      function median")}
  ${sourceBetween("      function median", "      function telemetryLapIsAnalyzable")}
  ${sourceBetween("      function telemetryLapIsAnalyzable", "      function telemetryProgress")}
  ${sourceBetween("      function gpsDistance", "      function nearestGpsGate")}
`, context);

function circleLap(lap, ms, length, radiusScale = 1) {
  const count = 620;
  const radiusMeters = length / (2 * Math.PI) * radiusScale;
  const latitude = 50.079;
  const longitude = 12.373;
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index / (count - 1) * Math.PI * 2;
    return [
      latitude + Math.sin(angle) * radiusMeters / 111320,
      longitude + Math.cos(angle) * radiusMeters / (111320 * Math.cos(latitude * Math.PI / 180)),
      70,
      7000
    ];
  });
  return { lap, ms, points };
}

function session(time, lapTimes, lengths) {
  const laps = lapTimes.map((ms, index) => ({ lap: index + 1, ms, maxSpeed: 90, maxRpm: 7300 }));
  return {
    fileName: `CHEB-${time}.zip`, date: "28-09-2026", time, timestamp: time === "10:23" ? 1 : 2,
    track: "YPSILONKA CHEB", driver: "JJ", laps,
    gpsLaps: laps.map((item, index) => circleLap(item.lap, item.ms, lengths[index])),
    bestMs: Math.min(...lapTimes), bestLap: lapTimes.indexOf(Math.min(...lapTimes)) + 1
  };
}

const mixed = session("10:23", [58180, 53670, 53810, 53000, 52740, 52560, 52500, 52310, 52330, 52820, 62740, 62650], [948, 946, 950, 952, 948, 948, 948, 947, 949, 952, 1172, 1174]);
const full = session("11:22", [68660, 63670, 62630, 62550, 62200, 62200, 61840, 61560, 61760, 61600, 61240, 61210], [1183, 1181, 1179, 1179, 1178, 1179, 1173, 1175, 1175, 1175, 1176, 1176]);

const expanded = context.expandMixedTrackSessions([mixed, full]);
assert.equal(expanded.length, 3);
const shortVariant = expanded.find((item) => item._trackVariantRole === "short");
const longVariant = expanded.find((item) => item._trackVariantRole === "long");
const fullSession = expanded.find((item) => item.time === "11:22");
assert.deepEqual(Array.from(shortVariant.laps, (lap) => lap.lap), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.deepEqual(Array.from(longVariant.laps, (lap) => lap.lap), [11, 12]);
assert.equal(shortVariant.bestMs, 52310);
assert.equal(longVariant.bestMs, 62650);
assert.equal(context.physicalSessionCount(expanded), 2);
assert.equal(context.physicalLapCount(expanded), 24);

context.alfanoSessions = expanded;
context.assignTrackConfigurations(expanded);
assert.notEqual(context.trackConfigurationKey(shortVariant), context.trackConfigurationKey(longVariant));
assert.equal(context.trackConfigurationKey(longVariant), context.trackConfigurationKey(fullSession));
assert.match(context.trackConfigurationName(shortVariant), /krátká/);
assert.match(context.trackConfigurationName(longVariant), /dlouhá/);
assert.match(context.trackConfigurationName(fullSession), /dlouhá/);

console.log("Cheb mixed session: laps 1–10 short, 11–12 long; 24 laps preserved across 2 physical sessions");
