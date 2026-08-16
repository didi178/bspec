/* Invalid-mutant audit: reconstruct every mutant's source, confirm it parses AND
   imports cleanly. A mutant that fails to load would produce a SPURIOUS kill in
   both suites, so it must be excluded from test-weakness evidence. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const rep = JSON.parse(readFileSync("reports/builder/mutation-report.json", "utf8"));
const file = Object.keys(rep.files)[0];
const source = rep.files[file].source;
const lines = source.split("\n");

// Byte offset of (1-based line, 1-based column)
const offset = (line, col) => {
  let o = 0;
  for (let i = 0; i < line - 1; i++) o += lines[i].length + 1;
  return o + (col - 1);
};
const apply = (m) => {
  const s = offset(m.location.start.line, m.location.start.column);
  const e = offset(m.location.end.line, m.location.end.column);
  return { mutated: source.slice(0, s) + m.replacement + source.slice(e), replaced: source.slice(s, e) };
};

mkdirSync("audit", { recursive: true });
const results = [];
for (const m of rep.files[file].mutants) {
  const { mutated, replaced } = apply(m);
  const p = `audit/m${m.id}.ts`;
  writeFileSync(p, mutated);
  let loads = true, err = "";
  try {
    execFileSync(process.execPath, ["-e", `import(${JSON.stringify("./" + p)}).then(m=>{if(typeof m.Wallet!=="function")throw new Error("no Wallet export");}).catch(e=>{console.error(e.message);process.exit(1)})`], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) { loads = false; err = String(e.stderr || e.message).trim().split("\n")[0]; }
  results.push({ id: m.id, mutator: m.mutatorName, line: m.location.start.line,
                 replacedText: replaced, replacement: m.replacement, loads, err });
}
rmSync("audit", { recursive: true, force: true });

const bad = results.filter(r => !r.loads);
console.log(`mutants audited        : ${results.length}`);
console.log(`load/parse OK          : ${results.filter(r => r.loads).length}`);
console.log(`INVALID (fail to load) : ${bad.length}`);
bad.forEach(r => console.log(`   id=${r.id} L${r.line} ${r.mutator} ${JSON.stringify(r.replacement)} -> ${r.err}`));

// Sanity: reconstruction fidelity. The replaced span must look like real source.
const sample = results.filter(r => r.mutator === "StringLiteral").slice(0, 4);
console.log("\nreconstruction spot-check (StringLiteral replaced spans):");
sample.forEach(r => console.log(`   L${r.line}: replaced ${JSON.stringify(r.replacedText)} with ${JSON.stringify(r.replacement)}`));
writeFileSync("reports/validity-audit.json", JSON.stringify({ total: results.length, invalid: bad.length, results }, null, 2));
console.log("\nwrote reports/validity-audit.json");
