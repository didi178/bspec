# Construction Notes — failures encountered while building (run 0001)

The builder prompt requires reporting failures met during construction. There
were **no implementation-logic failures** — the wallet passed its tests on the
first run. The only issue was a **toolchain invocation** matter, recorded here
for honesty and reproducibility:

1. **`node --test <dir>` did not discover tests.**
   - Initial `package.json` script was `node --test ../tests/` (a directory).
   - On Node v25.5.0 this raised `MODULE_NOT_FOUND` (`Cannot find module
     .../tests`) — the runner treated the directory path as a single module
     entry rather than a discovery root.
   - **Fix:** pass an explicit glob — `node --test "../tests/*.test.ts"`. With
     the glob, all 15 tests are discovered and pass.
   - Classification: toolchain/invocation, **not** an implementation defect.

Final state: `node --test "tests/*.test.ts"` → 15 pass / 0 fail (see
`test-output.txt`).
