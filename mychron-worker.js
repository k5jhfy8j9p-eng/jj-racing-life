import { parseXrk } from "./vendor/aim-xrk.min.js";

function channel(log, name) {
  return log.channels && log.channels[name] || null;
}

function valueAt(data, time, fallback) {
  if (!data || !data.timecodes || !data.timecodes.length) return fallback;
  var times = data.timecodes;
  var values = data.values;
  var low = 0, high = times.length - 1;
  if (time <= times[0]) return Number(values[0]);
  if (time >= times[high]) return Number(values[high]);
  while (low + 1 < high) {
    var middle = (low + high) >> 1;
    if (times[middle] <= time) low = middle; else high = middle;
  }
  if (!data.interpolate || times[high] === times[low]) return Number(values[low]);
  var ratio = (time - times[low]) / (times[high] - times[low]);
  return Number(values[low]) + (Number(values[high]) - Number(values[low])) * ratio;
}

function canonicalTrack(value) {
  var name = String(value || "Trať").trim();
  return /steel|třinec|trinec/i.test(name) ? "Steel Ring" : name;
}

function dateParts(metadata) {
  var rawDate = String(metadata["Log Date"] || "");
  var rawTime = String(metadata["Log Time"] || "00:00");
  var parts = rawDate.split(/[/.\-]/).map(Number);
  var month = parts[0] || 1, day = parts[1] || 1, year = parts[2] || 1970;
  if (year < 100) year += 2000;
  var date = String(day).padStart(2, "0") + "-" + String(month).padStart(2, "0") + "-" + year;
  var time = rawTime.slice(0, 5);
  return { date: date, time: time, timestamp: new Date(year, month - 1, day, Number(time.slice(0, 2)), Number(time.slice(3, 5))).getTime() };
}

function distanceMeters(first, second) {
  var toRad = Math.PI / 180;
  var lat = (first[0] + second[0]) / 2 * toRad;
  var x = (second[1] - first[1]) * toRad * Math.cos(lat);
  var y = (second[0] - first[0]) * toRad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

function normalizeXrk(fileName, bytes) {
  var log = parseXrk(bytes);
  var latitude = channel(log, "GPS Latitude");
  var longitude = channel(log, "GPS Longitude");
  var speed = channel(log, "GPS Speed");
  var rpm = channel(log, "RPM");
  var inline = channel(log, "GPS_InlineAcc");
  var lateral = channel(log, "GPS_LateralAcc");
  if (!latitude || !longitude || !speed || !log.laps || !log.laps.length) throw new Error(fileName + ": chybí GPS nebo kola.");

  var maximumSpeed = 0;
  for (var speedIndex = 0; speedIndex < speed.values.length; speedIndex += 1) maximumSpeed = Math.max(maximumSpeed, Number(speed.values[speedIndex]) * 3.6);
  if (maximumSpeed < 20) throw new Error(fileName + ": záznam neobsahuje skutečnou jízdu.");

  var laps = [];
  var gpsLaps = [];
  log.laps.forEach(function (lap, index) {
    var milliseconds = Math.round(lap.endTime - lap.startTime);
    if (!Number.isFinite(milliseconds) || milliseconds < 30000 || milliseconds > 180000) return;
    var points = [];
    var startIndex = 0;
    while (startIndex < latitude.timecodes.length && latitude.timecodes[startIndex] < lap.startTime) startIndex += 1;
    for (var pointIndex = startIndex; pointIndex < latitude.timecodes.length && latitude.timecodes[pointIndex] <= lap.endTime; pointIndex += 1) {
      var sampleTime = latitude.timecodes[pointIndex];
      var lat = Number(latitude.values[pointIndex]);
      var lon = valueAt(longitude, sampleTime, NaN);
      var speedKmh = valueAt(speed, sampleTime, 0) * 3.6;
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !lat || !lon) continue;
      points.push([lat, lon, speedKmh, valueAt(rpm, sampleTime, 0), valueAt(inline, sampleTime, 0), valueAt(lateral, sampleTime, 0), 0]);
    }
    if (points.length < 100) return;
    var pathLength = 0;
    for (var pathIndex = 1; pathIndex < points.length; pathIndex += 1) {
      pathLength += distanceMeters(points[pathIndex - 1], points[pathIndex]);
      var dy = points[pathIndex][0] - points[pathIndex - 1][0];
      var dx = (points[pathIndex][1] - points[pathIndex - 1][1]) * Math.cos(points[pathIndex][0] * Math.PI / 180);
      points[pathIndex][6] = Math.atan2(dx, dy) * 180 / Math.PI;
    }
    if (pathLength < 500) return;
    var lapNumber = Number(lap.num) + 1;
    var lapMaximumSpeed = points.reduce(function (maximum, point) { return Math.max(maximum, Number(point[2]) || 0); }, 0);
    var lapMaximumRpm = points.reduce(function (maximum, point) { return Math.max(maximum, Number(point[3]) || 0); }, 0);
    laps.push({ lap: lapNumber, ms: milliseconds, maxSpeed: lapMaximumSpeed, maxRpm: lapMaximumRpm });
    gpsLaps.push({ lap: lapNumber, ms: milliseconds, points: points });
  });
  if (!laps.length) throw new Error(fileName + ": nebylo nalezeno žádné úplné měřené kolo.");
  var best = laps.reduce(function (current, lap) { return lap.ms < current.ms ? lap : current; }, laps[0]);
  var parsedDate = dateParts(log.metadata || {});
  return {
    fileName: fileName,
    source: "mychron",
    driver: "Tomáš",
    track: canonicalTrack(log.metadata && log.metadata.Venue),
    date: parsedDate.date,
    time: parsedDate.time,
    timestamp: parsedDate.timestamp,
    laps: laps,
    gpsLaps: gpsLaps,
    bestMs: best.ms,
    bestLap: best.lap,
    maxSpeed: maximumSpeed,
    gpsSampleStep: 1
  };
}

self.onmessage = function (event) {
  try {
    var session = normalizeXrk(event.data.name, new Uint8Array(event.data.buffer));
    self.postMessage({ ok: true, session: session });
  } catch (error) {
    self.postMessage({ ok: false, error: error && error.message ? error.message : "XRK se nepodařilo načíst." });
  }
};
