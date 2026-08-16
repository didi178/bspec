import { readFileSync, writeFileSync } from "node:fs";
const j = JSON.parse(readFileSync("reports/mutants-joined.json", "utf8"));
const REGIONS = [
  [50, 50, "DEFAULT_MAX_BALANCE constant"],
  [52, 61, "toIntAmount() — amount normalization"],
  [63, 81, "constructor + option validation"],
  [83, 86, "balance() reader"],
  [88, 91, "maxBalance getter"],
  [93, 106, "deposit()"],
  [108, 120, "withdraw()"],
  [121, 126, "#reject()"],
];
const region = (l) => REGIONS.find(([a, b]) => l >= a && l <= b)?.[2] ?? `other (L${l})`;
const agg = new Map();
for (const m of j.mutants) {
  const r = region(m.line);
  if (!agg.has(r)) agg.set(r, { total: 0, both: 0, "builder-only": 0, "adversary-only": 0, neither: 0, bKill: 0, aKill: 0 });
  const a = agg.get(r);
  a.total++; a[m.bucket]++; if (m.bKilled) a.bKill++; if (m.aKilled) a.aKill++;
}
const rows = [...agg.entries()].sort((x, y) => REGIONS.findIndex(r => r[2] === x[0]) - REGIONS.findIndex(r => r[2] === y[0]));
console.log("| Region | Mutants | Builder killed | Adversary killed | Adv-only | Survived both |");
console.log("|---|--:|--:|--:|--:|--:|");
for (const [r, a] of rows)
  console.log(`| ${r} | ${a.total} | ${a.bKill} (${(100*a.bKill/a.total).toFixed(0)}%) | ${a.aKill} (${(100*a.aKill/a.total).toFixed(0)}%) | ${a["adversary-only"]} | ${a.neither} |`);

const byMutator = new Map();
for (const m of j.mutants) {
  if (!byMutator.has(m.mutator)) byMutator.set(m.mutator, { total: 0, b: 0, a: 0 });
  const x = byMutator.get(m.mutator); x.total++; if (m.bKilled) x.b++; if (m.aKilled) x.a++;
}
console.log("\n| Mutator | Mutants | Builder killed | Adversary killed |");
console.log("|---|--:|--:|--:|");
for (const [k, v] of [...byMutator].sort((p,q)=>q[1].total-p[1].total))
  console.log(`| ${k} | ${v.total} | ${v.b} | ${v.a} |`);
writeFileSync("reports/region-breakdown.json", JSON.stringify({ regions: Object.fromEntries(rows), mutators: Object.fromEntries(byMutator) }, null, 2));
