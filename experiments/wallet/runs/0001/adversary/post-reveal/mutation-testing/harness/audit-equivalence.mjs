/* Equivalence audit for surviving mutants.
   Differentially executes ORIGINAL vs MUTANT over a broad corpus and compares
   every observable: thrown type, thrown MESSAGE, balance, maxBalance, and the
   full result object of each operation. A mutant with no observable difference
   anywhere is a SUSPECTED EQUIVALENT (excluded from test-weakness evidence).
   A mutant differing only in error message text is GENUINE but message-only. */
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const rep = JSON.parse(readFileSync("reports/builder/mutation-report.json", "utf8"));
const adv = JSON.parse(readFileSync("reports/adversary/mutation-report.json", "utf8"));
const file = Object.keys(rep.files)[0];
const source = rep.files[file].source;
const lines = source.split("\n");
const offset = (l, c) => { let o = 0; for (let i = 0; i < l - 1; i++) o += lines[i].length + 1; return o + (c - 1); };

const advByKey = new Map(adv.files[file].mutants.map(m => [
  `${m.mutatorName}@${m.location.start.line}:${m.location.start.column}-${m.location.end.line}:${m.location.end.column}|${m.replacement ?? ""}`, m]));
const survivors = rep.files[file].mutants.filter(m => {
  const k = `${m.mutatorName}@${m.location.start.line}:${m.location.start.column}-${m.location.end.line}:${m.location.end.column}|${m.replacement ?? ""}`;
  return m.status === "Survived" && advByKey.get(k)?.status === "Survived";
});

// ---- corpus ------------------------------------------------------------
const AMOUNTS = [0n,1n,-1n,5n,100n,(1n<<63n)-1n,(1n<<63n),1n<<200n,-(1n<<200n),
  0,-0,1,-1,1.5,NaN,Infinity,-Infinity,2**53,2**53-1,1e21,"10","",null,undefined,
  true,false,{},[],Symbol.for("s"),(()=>1),new Date(0),new Number(5),{valueOf:()=>5}];
const CTORS = [undefined,{},{initialBalance:0n},{initialBalance:100n},{initialBalance:-1n},
  {maxBalance:-1n},{maxBalance:0n},{maxBalance:100n},{initialBalance:10n,maxBalance:5n},
  {initialBalance:5n,maxBalance:10n},{initialBalance:-1n,maxBalance:-1n},
  {maxBalance:-5n,initialBalance:3n},{initialBalance:1 },{maxBalance:1},
  {initialBalance:"x"},{maxBalance:"x"},{initialBalance:null},{maxBalance:null}];

const show = (v) => { try { return typeof v === "bigint" ? v+"n" : typeof v === "symbol" ? "sym"
  : v && typeof v === "object" ? JSON.stringify(v, (k,x)=>typeof x==="bigint"?x+"n":x) : String(v); } catch { return "?"; } };

async function trace(mod) {
  const { Wallet } = await import(mod);
  const out = [];
  for (const c of CTORS) {
    let w;
    try { w = c === undefined ? new Wallet() : new Wallet(c); }
    catch (e) { out.push(`ctor ${show(c)} => THROW ${e.constructor.name}: ${e.message}`); continue; }
    out.push(`ctor ${show(c)} => bal=${show(w.balance())} max=${show(w.maxBalance)}`);
    for (const a of AMOUNTS) {
      for (const op of ["deposit","withdraw"]) {
        try { out.push(`  ${op}(${show(a)}) => ${show(w[op](a))}`); }
        catch (e) { out.push(`  ${op}(${show(a)}) => THROW ${e.constructor.name}: ${e.message}`); }
      }
    }
  }
  return out;
}

mkdirSync("eqaudit", { recursive: true });
writeFileSync("eqaudit/original.ts", source);
const base = await trace("./eqaudit/original.ts");

const findings = [];
for (const m of survivors) {
  const s = offset(m.location.start.line, m.location.start.column);
  const e = offset(m.location.end.line, m.location.end.column);
  const p = `eqaudit/mut${m.id}.ts`;
  writeFileSync(p, source.slice(0, s) + m.replacement + source.slice(e));
  const t = await trace("./" + p);
  const diffs = [];
  for (let i = 0; i < Math.max(base.length, t.length); i++)
    if (base[i] !== t[i]) diffs.push({ original: base[i], mutant: t[i] });
  const msgOnly = diffs.length > 0 && diffs.every(d =>
    d.original?.includes("THROW") && d.mutant?.includes("THROW") &&
    d.original.split(":")[0] === d.mutant.split(":")[0]);
  findings.push({ id: m.id, mutator: m.mutatorName, line: m.location.start.line,
    replaced: source.slice(s, e), replacement: m.replacement,
    observableDiffs: diffs.length, sample: diffs.slice(0, 3),
    verdict: diffs.length === 0 ? "SUSPECTED_EQUIVALENT" : msgOnly ? "GENUINE_message-text-only" : "GENUINE_behavioral" });
}
rmSync("eqaudit", { recursive: true, force: true });

for (const f of findings) {
  console.log(`\n--- mutant ${f.id}  L${f.line}  ${f.mutator}`);
  console.log(`    ${JSON.stringify(f.replaced)}  ->  ${JSON.stringify(f.replacement)}`);
  console.log(`    observable differences over ${CTORS.length} ctors x ${AMOUNTS.length} amounts x 2 ops: ${f.observableDiffs}`);
  console.log(`    VERDICT: ${f.verdict}`);
  f.sample.forEach(d => console.log(`      orig: ${d.original}\n      mut : ${d.mutant}`));
}
writeFileSync("reports/equivalence-audit.json", JSON.stringify({ corpusSize: CTORS.length * AMOUNTS.length * 2, findings }, null, 2));
console.log(`\nwrote reports/equivalence-audit.json`);
