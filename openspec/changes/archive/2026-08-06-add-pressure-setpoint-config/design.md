## Context

The vacuum pressure chart plots measured values that already flow through the full pipeline: `post_data_plc.js` decodes a 32-bit LE float from registers D4+D5 into `ap_suat_chan_khong`, writes it into every stage's `bien_du_lieu` (stages 1 through 4), and `useFleetHistory` builds an `apSeries` from it for both the latest and previous batch generations.

What the chart lacks is a reference line. The temperature chart has one because the PLC exposes per-stage setpoint registers (D500/D502/D504 → `nhiet_do_cai_dat`), which `setpointBuilder.ts` turns into a dashed step line. No equivalent register exists for pressure, so the target values have to be supplied by a human.

The rendering machinery is already built and in production use for temperature:

```
useFleetHistory ──> setpointSeries ──> FleetLineChart ──> buildMerged(series, setpointSeries)
                                                              │
                                            measured → column m${n}, linearly interpolated
                                            setpoint → column s${n}, stepAfter + connectNulls
                                                              │
                                                     vMin/vMax spans BOTH groups
```

This change feeds a second setpoint series into that same path rather than building a parallel one. Two pieces of that path are currently temperature-specific and must be generalized first — the hard-coded legend name at `FleetLineChart.tsx:329` and the hard-wired `TEMPERATURE_WARNING_DELTA` deviation check at `FleetLineChart.tsx:92`.

Constraints inherited from the codebase: Express 5 + Mongoose 9 on the backend with all REST handlers in `backend/controller/home.js` and routes in `backend/router/home.js` mounted behind `app.use(auth.requireAuth, home)`; React + Vite + Tailwind + Recharts on the frontend; comments and UI copy in Vietnamese; pure logic modules split out of hooks so `node:test` can exercise them without React.

## Goals / Non-Goals

**Goals:**
- Let an operator enter one fleet-wide target pressure per stage and see it drawn against the measured curve on both the Overview and detail pages.
- Persist the values server-side so every device shows the same reference.
- Reuse the existing setpoint rendering path; add no parallel charting mechanism.
- Generalize the two temperature-specific pieces of `FleetLineChart` without altering the temperature chart's current output.
- Keep the derivation logic in a pure, React-free module so it is unit-testable like `setpointBuilder.ts`.

**Non-Goals:**
- Per-machine pressure targets. The stored shape is deliberately flat (four values, no machine dimension).
- Writing values back to the PLC or HMI. These numbers only draw a line.
- Correcting the `"bar"` unit label, despite measured magnitudes (680, 720) suggesting mmHg.
- Changing temperature setpoint behavior or `setpointBuilder.ts`.
- Adding the settings entry to the detail page's `TabBar.tsx` sidebar.
- Touching Modbus address offsets.

## Decisions

### D1: Server-side singleton document over localStorage

The configuration lives in a MongoDB collection holding exactly one document, read and written through two authenticated REST endpoints.

*Alternative considered — localStorage:* no backend work at all, but each browser would carry its own target line. A reference line that differs per device defeats the purpose: two operators comparing the same batch would disagree about whether the machine ran correctly. Clearing site data would silently erase the configuration.

The singleton is addressed via a fixed filter with `upsert: true`, so the first write creates the document and no seeding step or migration is needed. Read returns four `null`s rather than 404 when the document is absent — "not configured yet" is a valid state the UI must render as empty inputs, not as an error.

### D2: Fleet-wide scope, flat storage shape

One set of four values applies to all eight machines. Target pressure is a property of the frying recipe, not of an individual vessel.

*Alternative considered — per-machine (8 × 4 = 32 inputs):* more flexible, but it makes the common case (all machines run the same recipe) tedious and drift-prone, and it would multiply the pressure chart's target lines by eight on the Overview page, burying the measured curves. Storing flat now and layering per-machine overrides later is a strictly easier migration than collapsing per-machine values into a shared one.

### D3: All four stages, unlike temperature's three

Temperature setpoints cover stages 1 through 3 because the PLC does not regulate heat during stage 4 (`thoi_gian_treo_long`). Pressure is different: `post_data_plc.js` writes `ap_suat_chan_khong` into `newData_gd_4` as well, so measured pressure data exists for stage 4. Limiting targets to stages 1–3 would leave the reference line ending partway through a batch while the measured line continues — reading as a data gap rather than a deliberate boundary.

### D4: Derive target points from measured points, not from a synthetic time grid

The builder walks the measured pressure `ChartPoint[]` — each of which already carries its `stage` — and emits one target point at the same `phut` with the configured value for that stage.

*Alternative considered — synthesizing points at stage boundaries:* fewer points, but it requires knowing each stage's start and end minute, which is not directly available in the series and would have to be reconstructed. Deriving from measured points guarantees the target line spans exactly the same X range as the measured line, needs no boundary inference, and automatically respects `MAX_POINTS` capping since the input is already capped. The redundancy costs nothing: `buildMerged` writes the setpoint column with `findExactOrLastBefore` and Recharts renders it `stepAfter`, so repeated identical values collapse into flat segments.

### D5: Zero treated as "no line" at the chart layer, accepted at the API layer

Server validation accepts `0` as a legitimate stored number. The chart builder treats `0`, `null`, `NaN`, `Infinity`, and `undefined` alike as "no target for this stage".

This split mirrors `setpointBuilder.ts`, whose `isValidSetpoint` already rejects `0` — and for a concrete reason documented in `test/setpoint_builder.test.js`: a phantom zero line drags the Y axis domain down to zero and squashes both curves into the top of the plot. The API stays permissive because rejecting `0` outright would be a surprising validation error for a value that is numerically fine; the display layer is where the axis-scaling consequence actually bites.

### D6: Empty input means null, never zero

An empty input submits `null`. Coercing empty to `0` would both store a false measurement-like value and, given D5, silently produce no line while the stored data claims a target of zero exists.

### D7: Generalize `FleetLineChart` via defaulted props

Two props are added: the setpoint legend label (default `"Nhiệt độ cài đặt"`) and the deviation warning threshold (default `TEMPERATURE_WARNING_DELTA`). Defaults preserve the temperature chart's behavior exactly, so no existing call site needs to change to stay correct.

*Alternative considered — a chart-kind discriminator (`kind="temperature" | "pressure"`):* pushes presentation knowledge into the chart component and would need editing again for a third chart. Plain defaulted props keep the component agnostic.

### D8: No fabricated pressure warning threshold

The temperature chart highlights deviations of at least 3 °C. There is no comparable published or codebase-grounded figure for this system's vacuum pressure, and the very unit is uncertain (labelled `"bar"`, values around 680–720, most likely mmHg). Inventing a threshold would paint red warnings on readings that may be perfectly normal — actively misleading in a monitoring tool.

The pressure tooltip therefore shows the numeric deviation without any warning highlight. The prop exists so a justified threshold can be supplied later, once operations establishes one from real batch data.

### D9: Configuration fetched in `useFleetHistory`, refreshed on save without reload

`useFleetHistory` already owns both the measured series and the temperature setpoint series, so it is the natural place to fetch the configuration and derive the pressure target series for both generations.

After a successful save, the displayed charts must reflect the new values without a manual refresh — an operator who saves a target and sees the old line has no way to tell whether the save worked. The implementation needs a mechanism that propagates the saved configuration to the hook (a shared source of truth, an explicit refresh signal, or equivalent); the requirement is the observable outcome, not a particular technique.

## Risks / Trade-offs

**A target line drawn in the wrong unit misleads operators** → The chart's `"bar"` label is likely wrong (measured values sit near 680–720), and this change does not fix it. Whatever unit the measured line uses, the input takes numbers on that same scale, so measured and target remain directly comparable and the deviation figure stays meaningful. The label is inherited, pre-existing inaccuracy, flagged to the user and deliberately left alone; correcting it should be its own change so the fix is visible rather than buried here.

**Editing `useFleetHistory` risks regressing the generational batch logic** → The file carries intricate `genRef` / `fleetGenRef` rotation logic that routes each machine's data between "latest" and "previous". The pressure target series must follow the same routing as `apSeries`, including on rotation, when `previous` is populated from `latest`, and on REST refetch. Mitigation: mirror the existing `spPts` / `latestSpPtsRef` / `prevSpPtsRef` handling exactly rather than inventing new placement, and keep `generational_chart.test.js`, `per_machine_chart.test.js`, `refetch_on_rotation.test.js`, and `fleet_history_guard.test.js` green.

**`FleetLineChart` is shared by four chart instances across two pages** → A careless change to the label or threshold breaks the temperature charts. Mitigation: both new props default to today's exact values, so any call site that does not opt in is unaffected.

**Zero-versus-null handling is easy to get subtly wrong** → Three layers each treat these values differently (API accepts `0`, chart rejects it, empty input becomes `null`). Mitigation: the new test file covers `0`, `null`, `NaN`, `Infinity`, and `undefined` explicitly, following the precedent already set in `setpoint_builder.test.js`.

**A single dashed line could be mistaken for one machine's data** → On the Overview page with eight colored measured lines, one grey dashed line must read as a fleet-wide reference. Mitigation: it reuses the temperature setpoint's established visual language (grey, dashed, no dots), which operators already read as "target", plus an explicit legend label distinguishing it from `"Nhiệt độ cài đặt"`.

## Migration Plan

No migration is required. The new collection is created implicitly on first save via upsert, and the read path returns four `null`s until then, which the UI renders as empty inputs and the chart renders as no target line. Existing batch documents are untouched.

Rollback is a code revert: the configuration document can remain in the database harmlessly, and reverting the frontend simply stops drawing the target line. No data written by this change is consumed by the PLC pipeline or by any existing endpoint.

## Open Questions

- **The true pressure unit.** Labelled `"bar"`, but values near 680–720 point to mmHg. Deliberately out of scope here; it affects only the axis/tooltip label text, not the comparability of measured versus target.
- **A justified pressure deviation threshold.** Left unset by D8. Once operations derives one from real batches, it can be supplied through the prop added by D7 without further structural change.
