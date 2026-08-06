## Context

The pressure setpoint feature shipped earlier today and is running in the local Docker stack with real values (700/680/660/640) saved through the UI. It stores one flat set of four values shared by all 8 fryers, and every layer encodes that assumption:

```
Mongo singleton          {key, ap_suat_cai_dat: {giai_doan_1..4}}          flat
      │
REST GET/PUT             body: {ap_suat_cai_dat: {giai_doan_1..4}}         flat
      │
pressureSetpointBuilder  (measured[], config) → target[]                   no machine param
      │
useFleetHistory          union of ALL machines' minutes → ONE series n:0   sentinel
      │
FleetLineChart tooltip   findSharedSetpointKey → fall back to shared line  sentinel-aware
      │
Overview + FryerDetail   both draw the single dashed line
```

The sentinel `n: 0` exists precisely because a fleet-wide value belongs to no machine; `sharedSetpointKey.ts` was extracted (and tested) solely to let the tooltip pair measured lines against it. Reversing the storage decision therefore invalidates that whole sub-mechanism, not just the schema.

The prior design anticipated this: `add-pressure-setpoint-config` design D2 recorded that collapsing per-machine values into a shared one would be the hard direction, and expanding a shared value into per-machine ones the easy one. That asymmetry is what makes the migration here a pure fan-out with no data loss.

Constraints carried over: Express 5 + Mongoose 9 backend with handlers in `backend/controller/home.js` and routes in `backend/router/home.js` behind `app.use(auth.requireAuth, home)`; React + Vite + Tailwind + Recharts frontend; Vietnamese comments and UI copy; pure logic split out of hooks so `node:test` can exercise it without React.

## Goals / Non-Goals

**Goals:**
- Give each fryer 1–8 its own four stage setpoints.
- Preserve the operator's live configuration automatically — no manual re-entry, no migration script to run.
- Keep the settings modal usable when there are 32 values instead of 4.
- Keep the pressure chart readable now that targets differ per machine.
- Remove the sentinel mechanism completely rather than leaving it inert.
- Preserve every existing modal behavior (five states, validation, accessibility) and leave the temperature charts byte-identical.

**Non-Goals:**
- Correcting the `"bar"` unit label.
- Writing values to the PLC or HMI.
- Changing temperature setpoint behavior or `setpointBuilder.ts`.
- Introducing a pressure deviation warning threshold.
- Adding the settings entry to `TabBar.tsx`.
- Modbus offsets.
- Reverse-proxy route config — endpoint paths are unchanged, so the existing `/cai_dat_he_thong*` forwarding still applies.

## Decisions

### D1: Machine dimension keyed by machine number, single document retained

The configuration stays one singleton document under the same key; only `ap_suat_cai_dat` gains a machine dimension holding eight four-value groups.

*Alternative considered — one document per machine:* would suit per-machine writes, but the UI always loads and saves the whole fleet at once (the apply-to-all action is fleet-wide by nature), so eight documents would mean eight round trips and a partially-written fleet on failure. A single document keeps the existing atomic "validate everything, then write once" property that prevents half-saved configurations.

Machine numbers stay 1-based to match every other identifier in this system (`noi_chien_1..8`, `/may/:n`, socket rooms `noi_N`). A 0-based array would invite exactly the off-by-one that the sentinel `n: 0` already made confusing.

### D2: Legacy documents expand on read, not via a migration script

When the stored document carries the old flat shape, the read path treats its four values as applying to all 8 machines. The first subsequent write persists the new shape.

*Alternative considered — a one-off migration script:* requires an operator to run something at deploy time, and if they forget, the running system silently reports "not configured" and the operator's real values vanish from the UI — the exact failure the design must prevent. Read-time expansion needs no coordination with deployment and is idempotent.

*Alternative considered — migrate on startup:* still fine functionally, but it fires before Mongo is necessarily connected (the app retries connection in the background) and would need its own retry logic. Read-time expansion has no such ordering dependency.

The expansion is a pure function of the stored document, which makes it unit-testable without a database — important because this is the single point where a defect destroys a live operator's configuration.

### D3: Overview drops the pressure target line; the detail page keeps it

With per-machine targets, an 8-machine Overview pressure chart would carry 8 measured plus 8 dashed lines.

This is not a new judgement call — the temperature chart already faced it and resolved it the same way: `Overview.tsx` passes no setpoint props to the temperature chart, while `FryerDetail.tsx` does. Following that precedent makes the two charts consistent and keeps the Overview chart's purpose intact (comparing machines against each other, where per-machine targets add clutter rather than signal). The detail page is where a single machine is judged against its own target, and that is where the line belongs.

*Alternative considered — draw all 8 dashed lines on Overview:* rejected as strictly worse than the current state for the chart's actual job. *Alternative considered — draw only the selected machine's target on Overview:* the Overview has no "selected machine" concept.

### D4: Sentinel removed, tooltip pairs by machine number

`AP_SETPOINT_SERIES_N = 0`, `sharedSetpointKey.ts`, and `test/shared_setpoint_key.test.js` are deleted, and the tooltip pairs `m${n}` with `s${n}` — the behavior the temperature chart has always had.

Keeping the helper "just in case" would leave a module whose documented rationale (fleet-wide setpoints belong to no machine) is no longer true, and a test suite asserting a mechanism nothing uses. That is precisely the dead code that misleads the next reader.

A welcome side effect: the round-3 verification of the previous change flagged a latent flaw in the sentinel pairing — a single setpoint line whose own measured line was momentarily null could be smeared onto other machines. Removing the fallback eliminates that failure mode rather than papering over it.

### D5: Per-machine series derived per machine, dropping the union-of-minutes

`buildApSetpointSeries` currently unions every machine's minute marks to produce one line spanning the whole X range. With per-machine targets, each machine's series is derived from that machine's own measured points.

This is simpler and removes the `capPoints` compensation the union required: each machine's measured array is already capped at `MAX_POINTS`, so the derived target array inherits the cap — which is what design D4 of the previous change originally assumed before the union broke it. It also restores exact X alignment between each machine's measured and target lines.

The critical constraint: each series must carry its own machine's number so it flows through `pushState`, batch rotation (`genRef`/`fleetGenRef`), REST refetch, and live socket ticks exactly as that machine's `apSeries` does. The previous change solved this by deriving the setpoint series inside `pushState` from the already-routed measured arrays, so routing is inherited rather than hand-mirrored at each site. That structure is kept.

### D6: Modal shows one machine at a time, with apply-to-all

Rendering 32 inputs at once is unusable. The modal gains a 1–8 selector; the four inputs show the active machine's values.

Pending edits for all 8 machines live in modal state and are submitted together on save, so switching machines never discards work and a single request persists the fleet. The apply-to-all action copies the active machine's four entered values across all machines, keeping the common case (one recipe fleet-wide) a single entry — this is what preserves the ergonomics the flat design had.

Validation runs across all 8 machines' pending values, not just the visible one; otherwise an invalid value on a hidden machine would reach the server and be rejected there, showing an error the user cannot see the source of. When validation fails on a non-selected machine, the modal must make that machine reachable rather than reporting an error with no visible cause.

## Risks / Trade-offs

**A defect in legacy expansion silently destroys the operator's live configuration** → This is the highest-consequence risk in the change: the running stack holds real values entered through the UI, and a wrong expansion shows "not configured" with no error, inviting the operator to overwrite what was there. Mitigation: expansion is a pure function with unit tests covering flat-with-values, flat-with-nulls, already-new-shape, and empty; plus an end-to-end check against the actual running database confirming all 8 machines report 700/680/660/640 after the rebuild. Verification by real data, not by reasoning.

**Editing `useFleetHistory` again risks the generational batch logic** → The same `genRef`/`fleetGenRef` rotation that was the top regression risk last time is in scope again. Mitigation: keep the established structure of deriving the setpoint series inside `pushState` from already-routed measured arrays, so rotation, refetch, and live ticks are inherited rather than re-implemented; keep `generational_chart.test.js`, `per_machine_chart.test.js`, `refetch_on_rotation.test.js`, and `fleet_history_guard.test.js` green.

**Deleting the sentinel helper could disturb the temperature tooltip** → `FleetLineChart` is shared by four chart instances across two pages. Mitigation: the target state is exactly what the temperature chart did before the sentinel was introduced (pair `m${n}` with `s${n}`), so removal restores rather than invents behavior; both new props keep their current defaults.

**The modal grows a mode, and modes hide state** → With one machine visible at a time, unsaved edits on other machines are invisible, so a user could save without realizing what else is pending, or hit a validation error whose cause is off-screen. Mitigation: switching machines preserves edits (explicitly specified and tested), and validation failures on non-selected machines must identify the machine.

**API shape changes while the old client may still be loaded in a browser** → A tab opened before the rebuild will PUT the flat shape against the new server and be rejected. Acceptable: this is a single-operator local deployment, the rejection is a visible error rather than silent corruption, and a page reload resolves it.

## Migration Plan

No migration step runs. Legacy flat documents are expanded on read (D2), and the first save after the change persists the per-machine shape. Existing batch documents are untouched — this change does not read or write them.

Rollback is a code revert. A per-machine document read by the reverted (flat-shape) code would find no flat values and report "not configured", so the operator would re-enter four values once; no data is corrupted and no batch history is affected. Given the asymmetry recorded in the prior design — expansion is easy, collapse is lossy — rolling back after machines have diverged would necessarily lose the per-machine distinctions, which is inherent to reverting this decision rather than a defect in the plan.

## Open Questions

- **The true pressure unit** remains open from the previous change (labelled `"bar"`, values near 680–720 suggesting mmHg). Still out of scope; it affects label text only, not the comparability of measured against target.
- **A justified pressure deviation threshold** remains unset. The prop plumbing stays in place so a value can be supplied once operations derives one from real batch data.
