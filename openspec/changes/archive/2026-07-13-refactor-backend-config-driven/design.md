## Context

The backend duplicates one fryer's logic 8 times across `app.js` (2603 lines), `connectPLC.js`, `controller/post_data_to_db_1..8.js`, `model/noi_chien_1..8_data.js`, and `controller/home.js`. The copies are byte-identical except for the fryer number, and a few carry copy-paste bugs (e.g. `post_data_to_db_3.js` logs "nồi chiên 4"). The system is live against real PLCs at 192.168.1.51-58 and MongoDB is now local (Atlas removed from code but still in a git-tracked `.env`). This refactor is strictly behavior-preserving; the specs enumerate the observable contract that must not change.

## Goals / Non-Goals

**Goals:**
- One config-driven code path over an array of 8 PLCs replacing all 8 copies.
- Single shared Mongoose schema registering 8 models under the same collection names.
- Single parameterized DB-write function replacing 8 controllers, with normalized logs.
- `readAllRegisters` defined once, not per interval tick.
- Remove Atlas from source control (`.gitignore` + untrack `.env`); drop `crypto`/`buffer` from deps.

**Non-Goals:**
- Fixing the `id_document` restart-loss bug (kept as an in-memory map — same behavior).
- Batching Modbus reads (still one register at a time).
- Auth, XSS fixes, frontend refactor, `pubic`→`public` rename, git history rewrite.

## Decisions

**Decision: Single PLC config array as the source of truth.**
Define `PLC_CONFIGS = [{ index: 1, ipEnv: "IP_PLC1", model, dataEvent: "noi_chien_1_data", stopEvent: "noi_chien_1_stop" }, ...]` and iterate. Alternative (keep 8 blocks, dedupe only inner bodies) rejected — leaves `app.js` mostly duplicated. The register list is identical across fryers, so a single shared `registerList` template is cloned per fryer to preserve per-fryer `reg.val` mutation isolation (each fryer must keep its own value state, exactly as the 8 separate arrays did today).

**Decision: Per-fryer mutable state held in arrays/maps keyed by index.**
`isConnectPLC_N`, `values_PLC_N`, `Start_PLC_N`, `isStart_PLC_N`, `id_document_plc_N`, and the else-branch reconnect timers become index-keyed structures. This preserves the exact isolation the 8 copies had (fryer 3's values never bleed into fryer 4). `id_document` stays module-scoped in memory — no persistence added.

**Decision: One shared schema, 8 model registrations.**
Export an array/map of 8 models from one module: `mongoose.model("noi_chien_" + n, plcSchema)`. Keep the schema field definitions byte-identical, including the existing `require:` keys (NOT changed to `required:`) so validation behavior is unchanged.

**Decision: Parameterized `postDataPlc(model, n, values, io_, Start, gd1..gd4)`.**
Collapses the 8 controllers. Emits `noi_chien_${n}_data` / `noi_chien_${n}_stop` and logs with the correct `n`. Payload shape and Mongo update operators ($set/$push per stage) preserved exactly.

**Decision: `crypto`/`buffer` removed from package.json only.**
`require("crypto")` and `require("buffer")` resolve to Node built-ins regardless; removing the npm entries is safe and removes misleading/outdated packages.

## Risks / Trade-offs

- [Shared register array mutated across fryers] → Clone the template per fryer at startup so each fryer owns its `reg.val`, matching today's 8 separate arrays. Verify fryer value isolation.
- [Behavior drift during consolidation on a live system] → Step-by-step with Docker checks after each layer (1C); verify all 8 collections keep receiving documents and no uncaught exceptions.
- [Model registration order / name typo] → Assert model names are exactly `noi_chien_1..8`; spec scenario covers this.
- [`git rm --cached .env` accidentally deleting the file] → Use `--cached` only; confirm `.env` still on disk afterward.
- [Removing crypto/buffer breaks a transitive need] → They are Node core; grep shows only `require("crypto")`/`require("buffer")` usage which resolves to built-ins.

## Migration Plan

1. Untrack `.env` + `.gitignore` (no runtime impact).
2. Shared schema module → confirm 8 models register; Docker check.
3. Parameterized controller → Docker check, 8 collections still written.
4. `connectPLC.js` array API → Docker check.
5. `app.js` config-driven loop + one-time `readAllRegisters` → Docker check, all 8 collections + events.
6. `controller/home.js` lookup by index → route smoke check.
7. `package.json` deps cleanup → rebuild.

Rollback: revert the change branch; no data migration performed (collections unchanged).

## Open Questions

None — all decisions locked (1C + 2B + 3B) with the user.
