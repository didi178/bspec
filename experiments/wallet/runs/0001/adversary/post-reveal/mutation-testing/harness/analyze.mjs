import { readFileSync, writeFileSync } from "node:fs";

const load = (p) => {
  const r = JSON.parse(readFileSync(p, "utf8"));
  const file = Object.keys(r.files)[0];
  const src = r.files[file].source.split("\n");
  const out = new Map();
  for (const m of r.files[file].mutants) {
    const L = m.location;
    const key = `${m.mutatorName}@${L.start.line}:${L.start.column}-${L.end.line}:${L.end.column}|${m.replacement ?? ""}`;
    out.set(key, {
      key, mutator: m.mutatorName, line: L.start.line, col: L.start.column,
      endLine: L.end.line, endCol: L.end.column,
      replacement: m.replacement ?? "", status: m.status,
      statusReason: m.statusReason ?? "",
      original: src[L.start.line - 1]?.trim() ?? "",
    });
  }
  return { schemaVersion: r.schemaVersion, file, mutants: out };
};

const B = load("reports/builder/mutation-report.json");
const A = load("reports/adversary/mutation-report.json");

// --- Identity check: the two runs must have produced the SAME mutation set ---
const bk = [...B.mutants.keys()].sort(), ak = [...A.mutants.keys()].sort();
const identical = bk.length === ak.length && bk.every((k, i) => k === ak[i]);
console.log(`mutation sets identical: ${identical}  (builder=${bk.length}, adversary=${ak.length})`);
if (!identical) {
  console.log("only in builder :", bk.filter(k => !A.mutants.has(k)));
  console.log("only in adversary:", ak.filter(k => !B.mutants.has(k)));
  process.exit(1);
}

const st = (m) => m.status;
const counts = (M) => [...M.values()].reduce((a, m) => (a[st(m)] = (a[st(m)] || 0) + 1, a), {});
console.log("builder  status counts:", counts(B.mutants));
console.log("adversary status counts:", counts(A.mutants));

const rows = bk.map(k => {
  const b = B.mutants.get(k), a = A.mutants.get(k);
  const bKilled = b.status === "Killed" || b.status === "Timeout";
  const aKilled = a.status === "Killed" || a.status === "Timeout";
  return { ...b, builderStatus: b.status, adversaryStatus: a.status, bKilled, aKilled,
           bucket: bKilled && aKilled ? "both" : bKilled ? "builder-only" : aKilled ? "adversary-only" : "neither" };
});

const by = (x) => rows.filter(r => r.bucket === x);
console.log("\n=== cross-classification ===");
for (const b of ["both", "builder-only", "adversary-only", "neither"]) console.log(`${b.padEnd(16)}: ${by(b).length}`);

const fmt = (r) => `  L${String(r.line).padStart(3)}:${String(r.col).padStart(2)} ${r.mutator.padEnd(22)} ${JSON.stringify(r.replacement).slice(0,58).padEnd(60)} | ${r.original.slice(0,70)}`;
console.log("\n=== killed ONLY by adversary tests (" + by("adversary-only").length + ") ===");
by("adversary-only").forEach(r => console.log(fmt(r)));
console.log("\n=== killed ONLY by builder tests (" + by("builder-only").length + ") ===");
by("builder-only").forEach(r => console.log(fmt(r)));
console.log("\n=== survived BOTH suites (" + by("neither").length + ") ===");
by("neither").forEach(r => console.log(fmt(r)));

writeFileSync("reports/mutants-joined.json", JSON.stringify({
  generatedBy: "analyze.mjs", schemaVersion: B.schemaVersion, file: B.file,
  total: rows.length, identicalMutationSets: identical,
  summary: {
    builder: counts(B.mutants), adversary: counts(A.mutants),
    crossClassification: Object.fromEntries(["both","builder-only","adversary-only","neither"].map(b => [b, by(b).length])),
  },
  mutants: rows,
}, null, 2));
console.log("\nwrote reports/mutants-joined.json");
