/**
 * Adversary ambiguity + robustness probe — run 0001.
 *
 * Not a pass/fail test. This script RECORDS the choice the artifact made for
 * each question `README.md` left deliberately unresolved, plus a set of misuse
 * probes. Output is captured to ../evidence/probe-output.txt.
 *
 *   node tests/probe-ambiguity.ts
 */
import { Wallet } from "../../builder/implementation/wallet.ts";

const show = (v: unknown): string => {
  if (typeof v === "bigint") return `${v}n`;
  if (typeof v === "string") return JSON.stringify(v);
  if (v && typeof v === "object") {
    return `{${Object.entries(v).map(([k, x]) => `${k}: ${show(x)}`).join(", ")}}`;
  }
  return String(v);
};

const attempt = (label: string, fn: () => unknown) => {
  try {
    console.log(`  ${label.padEnd(52)} -> ${show(fn())}`);
  } catch (e) {
    const err = e as Error;
    console.log(`  ${label.padEnd(52)} -> THROWS ${err.constructor.name}: ${err.message}`);
  }
};

const section = (t: string) => console.log(`\n=== ${t} ===`);

section("Resolved-by-implementation: the unresolved questions");
const w = new Wallet();
console.log(`  currency                : ABSENT — no currency field, code, or unit anywhere`);
console.log(`  numeric representation  : bigint minor units; balance() typeof = ${typeof w.balance()}`);
console.log(`  smallest unit           : 1 minor unit (fractions rejected as INVALID_AMOUNT)`);
console.log(`  authorization           : ABSENT — no owner, caller, or credential; any holder may withdraw`);
console.log(`  idempotency             : ABSENT — no request id; repeats compound`);
console.log(`  persistence             : ABSENT — in-memory only; no save/load/serialize`);
console.log(`  concurrency             : UNDECLARED — sync methods are atomic by construction, not by statement`);
console.log(`  error semantics         : SPLIT — domain errors are tagged results; config errors THROW RangeError`);
console.log(`  balance ceiling         : ${w.maxBalance}n (= 2^63-1) — invented, not in the spec`);
console.log(`  history / audit trail   : ABSENT — no transaction log`);
console.log(`  transfer between wallets: ABSENT — no transfer operation`);

section("Error-code taxonomy actually observed");
const t = new Wallet({ initialBalance: 100n });
attempt("deposit(0n)", () => t.deposit(0n));
attempt("deposit(-1n)", () => t.deposit(-1n));
attempt("deposit('x')", () => t.deposit("x" as never));
attempt("deposit(2n**63n)", () => t.deposit(2n ** 63n));
attempt("withdraw(0n)", () => t.withdraw(0n));
attempt("withdraw(-1n)", () => t.withdraw(-1n));
attempt("withdraw(101n)  [insufficient]", () => t.withdraw(101n));
attempt("withdraw(-1n) on a ZERO balance", () => new Wallet().withdraw(-1n));

section("Misuse / robustness probes");
attempt("detached method: const {deposit} = w; deposit(1n)", () => {
  const { deposit } = new Wallet();
  return (deposit as (a: bigint) => unknown)(1n);
});
attempt("borrowed method: Wallet.prototype.deposit.call({}, 1n)", () =>
  (Wallet.prototype.deposit as (this: unknown, a: bigint) => unknown).call({}, 1n));
attempt("Object.create(Wallet.prototype).balance()", () =>
  (Object.create(Wallet.prototype) as Wallet).balance());
attempt("Reflect.ownKeys(instance)", () => Reflect.ownKeys(new Wallet({ initialBalance: 5n })));
attempt("JSON.stringify(instance)", () => JSON.stringify(new Wallet({ initialBalance: 5n })));
attempt("JSON.stringify(deposit result)", () => JSON.stringify(new Wallet().deposit(1n)));
attempt("structuredClone(instance) keys", () => Object.keys(structuredClone(new Wallet({ initialBalance: 5n }))));
attempt("String(balance())", () => String(new Wallet({ initialBalance: 5n }).balance()));
attempt("balance() * 1.5", () => (new Wallet({ initialBalance: 4n }).balance() as unknown as number) * 1.5);
attempt("new Wallet(null)", () => new Wallet(null as never).balance());
attempt("new Wallet('nope')", () => new Wallet("nope" as never).balance());
attempt("new Wallet({initialBalance: 100})  [number]", () => new Wallet({ initialBalance: 100 as never }).balance());
attempt("new Wallet({maxBalance: 100})      [number]", () => new Wallet({ maxBalance: 100 as never }).maxBalance);
attempt("new Wallet({intialBalance: 500n})  [typo]", () => new Wallet({ intialBalance: 500n } as never).balance());
attempt("new Wallet({initialBalance: undefined})", () => new Wallet({ initialBalance: undefined }).balance());
attempt("new Wallet({maxBalance: 0n}).deposit(1n)", () => new Wallet({ maxBalance: 0n }).deposit(1n));

section("Subclass override — reported balance can lie, real state cannot");
class Liar extends Wallet {
  balance(): bigint { return 10n ** 12n; }
}
const liar = new Liar({ initialBalance: 5n });
attempt("Liar.balance()  [overridden reporter]", () => liar.balance());
attempt("Liar.withdraw(6n)  [real state still governs]", () => liar.withdraw(6n));
attempt("Liar.withdraw(5n)  [real state still governs]", () => liar.withdraw(5n));

section("Prototype-chain option lookup (FINDING A-1)");
(Object.prototype as Record<string, unknown>).initialBalance = 1000n;
attempt("new Wallet()  with Object.prototype.initialBalance=1000n", () => new Wallet().balance());
delete (Object.prototype as Record<string, unknown>).initialBalance;
attempt("new Wallet()  after cleanup", () => new Wallet().balance());

section("Large-value handling");
attempt("deposit(10n**100n) on default wallet", () => new Wallet().deposit(10n ** 100n));
attempt("maxBalance 10n**60n, deposit 10n**60n", () => {
  const big = new Wallet({ maxBalance: 10n ** 60n });
  big.deposit(10n ** 60n);
  return big.balance();
});
attempt("Number.MAX_SAFE_INTEGER as a number amount", () =>
  new Wallet().deposit(Number.MAX_SAFE_INTEGER));
attempt("Number.MAX_SAFE_INTEGER + 1 as a number amount", () =>
  new Wallet().deposit(Number.MAX_SAFE_INTEGER + 1));

console.log("");
