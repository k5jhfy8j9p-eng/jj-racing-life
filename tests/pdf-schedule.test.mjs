import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as pdfjsLib from "/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function sourceBetween(start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Source block ${start} was not found`);
  return html.slice(from, to);
}

const context = vm.createContext({ console, Set, Map, String, Number, Array, Math, RegExp });
vm.runInContext(`
  function minutes(value) {
    var parts = value.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }
  function item(start, end, category, type, detail) {
    return { start: minutes(start), end: minutes(end), category: category, type: type, detail: detail || "" };
  }
  function scheduleIsValid(sessions) {
    return Array.isArray(sessions) && sessions.length >= 4 && sessions.every(function (session) {
      return Number.isFinite(session.start) && Number.isFinite(session.end) && session.end > session.start && Boolean(session.category);
    });
  }
  ${sourceBetween("      function isJuniorCategory", "      function scheduleIsValid")}
  ${sourceBetween("      function normalizedPdfText", "      async function extractPdfLines")}
  ${sourceBetween("      function parseScheduleLines", "      function parseSupportEvents")}
  ${sourceBetween("      function parseSupportEvents", "      async function loadPdfDay")}
`, context);

function groupTextItemsIntoLines(items) {
  const lines = [];
  items.forEach((textItem) => {
    if (!textItem.str || !textItem.str.trim() || !textItem.transform) return;
    const x = textItem.transform[4];
    const y = textItem.transform[5];
    let line = lines.find((candidate) => Math.abs(candidate.y - y) < 1.8);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }
    line.parts.push({ x, width: Number(textItem.width) || 0, text: textItem.str.trim() });
  });
  return lines.sort((a, b) => b.y - a.y).map((line) => {
    const parts = line.parts.sort((a, b) => a.x - b.x);
    return parts.map((part, index) => {
      if (!index) return part.text;
      const previous = parts[index - 1];
      const gap = part.x - (previous.x + previous.width);
      return `${gap > 24 ? " | " : gap > 2.2 ? " " : ""}${part.text}`;
    }).join("").replace(/\s+/g, " ").trim();
  });
}

async function extractLines(file) {
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    lines.push(...groupTextItemsIntoLines((await page.getTextContent()).items));
  }
  await pdf.destroy();
  return lines;
}

async function verify(file, expectedTotal, expectedTeamTimes) {
  const lines = await extractLines(file);
  const sessions = context.parseScheduleLines(lines);
  const supportEvents = context.parseSupportEvents(lines);
  const team = sessions.filter((session) => context.isJuniorCategory(session.category));
  assert.equal(sessions.length, expectedTotal, `${file}: unexpected schedule item count`);
  assert.deepEqual(Array.from(team, (session) => session.start), expectedTeamTimes, `${file}: incorrect T4 Junior sessions`);
  return { sessions, team, supportEvents };
}

const friday = await verify("patek4.pdf", 49, [502, 590, 678, 824, 912, 1000]);
const saturday = await verify("sobota4.pdf", 46, [510, 600, 690, 852, 992]);
const latestFriday = await verify("patek5.pdf", 49, [502, 590, 678, 824, 912, 1000]);
const latestSaturday = await verify("sobota5.pdf", 41, [490, 572, 666, 807, 937]);
await verify("patek3.pdf", 29, [555, 615, 675, 735, 825, 885, 945]);
await verify("sobota3.pdf", 21, [555, 615, 675, 800, 880]);

assert.ok(friday.team.every((session) => /T4\s*Junior/i.test(session.category)), "Friday selected another Junior class");
assert.ok(saturday.team.every((session) => /T4\s*Junior/i.test(session.category)), "Saturday selected another Junior class");

assert.deepEqual(Array.from(saturday.team, (session) => session.type), [
  "Warm-up", "Oficiální trénink", "Kvalifikace", "1. závod", "2. závod"
]);
assert.equal(friday.sessions.find((session) => session.start === 721)?.type, "Pauza");
assert.equal(saturday.sessions.find((session) => session.start === 750)?.type, "Pauza");
assert.equal(latestFriday.sessions.find((session) => session.start === 721)?.type, "Pauza");
assert.equal(latestSaturday.sessions.find((session) => session.start === 745)?.type, "Pauza");
assert.ok(latestSaturday.supportEvents.some((event) => event.start === 735 && event.end === 745 && /Rozprava|Briefing/i.test(event.title)), "Saturday briefing was not parsed as a support event");

console.log(`Friday: ${friday.sessions.length} items, ${friday.team.length} T4 Junior sessions`);
console.log(`Saturday: ${saturday.sessions.length} items, ${saturday.team.length} T4 Junior sessions`);
