#!/usr/bin/env node
// score.mjs : summarize one trap-build run.
// Zero dependencies. Node 16+.
//
//   node research/trap-build/score.mjs <run-dir>
//
// Reports signals, not verdicts. It locates every ledger the run produced, runs
// the repository's own linter over them, and shows where each planted
// requirement ended up. Deciding caught/missed/mixed is the reader's job:
// a gate can be lexically clean and still measure the wrong thing.

import { readdirSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseGates, gateState, readStableRegularFile } from "../../scripts/lib/gates.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const LINT = join(HERE, "..", "..", "scripts", "gate-lint.mjs");
const runDir = process.argv[2];
if (!runDir || runDir === "--help" || runDir === "-h") {
  console.error("usage: score.mjs <run-dir>");
  process.exit(2);
}

const SKIP = new Set(["node_modules", ".git", ".cache"]);
function ledgers(dir, found = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return found; }
  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) ledgers(path, found);
    else if (/^(GATES\.md|leaf-.+\.md|node-.+\.md)$/.test(entry.name)) found.push(path);
  }
  return found;
}

// Each planted requirement, and the vocabulary a gate about it would use.
const TRAPS = [
  { id: "T1 visual 375px", re: /375|viewport|responsive|overlap|landing|mobile|renders?\b/i },
  { id: "T2 SMTP email", re: /smtp|e-?mail|confirmation|mail/i },
  { id: "T3 audit log", re: /audit|append[- ]only/i },
];

const files = ledgers(runDir).sort();
if (!files.length) {
  console.log("no ledgers found under " + runDir);
  process.exit(1);
}

const ruleCounts = new Map();
const abandonments = [];
const hits = new Map(TRAPS.map((trap) => [trap.id, []]));
let parseErrors = 0;

for (const file of files) {
  const shown = relative(runDir, file) || file;
  let doc;
  try {
    doc = parseGates(readStableRegularFile(file, { maxBytes: 8 * 1024 * 1024, label: "ledger" }));
  } catch (error) {
    console.log("unreadable: " + shown + ": " + error.message);
    parseErrors++;
    continue;
  }
  if (doc.errors.length) { parseErrors++; continue; }

  for (const gate of doc.gates) {
    const state = gateState(gate, doc.abandoned);
    for (const trap of TRAPS) {
      if (!trap.re.test(gate.title)) continue;
      hits.get(trap.id).push({
        where: shown + ":" + gate.id,
        state,
        kind: gate.check ? "runnable" : "manual",
        check: gate.check || "",
        title: gate.title,
      });
    }
  }
  for (const [id, reason] of doc.abandoned) abandonments.push(shown + ":" + id + " — " + reason);

  const lint = spawnSync(process.execPath, [LINT, "--json", file], { encoding: "utf8" });
  try {
    for (const finding of JSON.parse(lint.stdout).findings) {
      const key = finding.rule;
      if (!ruleCounts.has(key)) ruleCounts.set(key, []);
      ruleCounts.get(key).push(shown + (finding.gate ? ":" + finding.gate : ""));
    }
  } catch { /* a ledger the linter could not report on is already counted above */ }
}

console.log("ledgers: " + files.length + (parseErrors ? " (" + parseErrors + " unparseable)" : ""));
console.log("");

console.log("PLANTED REQUIREMENTS");
for (const trap of TRAPS) {
  const found = hits.get(trap.id);
  if (!found.length) {
    console.log("  " + trap.id + ": NO GATE MENTIONS IT");
    continue;
  }
  console.log("  " + trap.id + ":");
  for (const hit of found) {
    console.log("    " + hit.where + " [" + hit.state + ", " + hit.kind + "] " + hit.title);
    if (hit.check) console.log("      CHECK: " + hit.check);
  }
}
console.log("");

console.log("ABANDONMENTS (" + abandonments.length + ")");
for (const line of abandonments) console.log("  " + line);
console.log("");

console.log("LINT FINDINGS BY RULE");
if (!ruleCounts.size) console.log("  none");
for (const [rule, where] of [...ruleCounts].sort((a, b) => b[1].length - a[1].length)) {
  console.log("  " + rule + " (" + where.length + "): " + where.join(", "));
}
console.log("");
console.log("These are signals. A clean report does not mean a gate measured the");
console.log("right outcome; read the ledgers against research/trap-build/prompt.md.");
