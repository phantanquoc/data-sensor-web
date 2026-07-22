# UI DNA — IoT Gateway Nồi Chiên Dashboard

Distilled design essence. Read before any visual change. Principles, not a changelog.

## Design tokens

- **Palette**: neutral canvas (light cool grey); surfaces are white with a faint cool gradient. Primary action/brand = mid blue; hover = a darker blue.
- **Value colors** (semantic, for numeric readouts): blue (time/primary), green (counts/OK), orange (seconds/overtime/warning), purple (repeat/interval), red (temperature/critical), teal (position/state).
- **Status**: running = blue/green accent; idle/stopped = muted grey; overtime = orange.
- **Spacing**: 8px base rhythm; common steps 12 / 16 / 20 / 24.
- **Radius**: cards 12–16px; inner chips 10–14px; pills fully rounded.
- **Shadow**: soft and low-alpha (large blur, small spread, ~8–20% opacity). Elevation communicates hover, not hierarchy.
- **Type**: sans-serif; section headings bold ~26–28px; numeric values bold 18–24px; labels 15px semibold.

## Component patterns

- **Card**: white/near-white gradient surface, rounded, soft shadow, generous padding (16–24px). Label left, value right.
- **Value chip**: bold number on a tinted rounded background, centered, min-width so columns align.
- **Tab / nav pill**: solid fill, rounded, bold; active state raised with a colored shadow.
- **Progress (linear)**: a long horizontal track with a filled portion; label + `elapsed / target đơn vị` beside or above it. Fill turns orange past target.
- **Progress (donut)**: legacy detail-view timer — hand-drawn SVG, preserved as-is; do not replace without explicit request.

## Interaction & motion

- Hover lifts a card ~3px with a stronger shadow, ~0.25s ease.
- Transitions are short (0.2–0.3s); avoid long or bouncy motion on an industrial monitor.
- Realtime values update in place; never block the UI on network or DB.

## Accessibility baseline

- Status must never rely on color alone — pair with a label ("Đang chạy" / "Dừng") or icon.
- Interactive elements are real buttons/links, keyboard-focusable, with a visible focus ring.
- Target AA contrast for text on tinted chips.

## Voice & tone

- Vietnamese, domain terms kept ("Hệ Chiên", "Giai đoạn", "Thời gian chạy", "ngập dầu").
- Labels are short noun phrases; values carry their unit ("phút", "lần", "S", "độ C").
- Notifications are calm and factual, non-blocking (toast, not alert).

## Layout & responsive

- Overview: responsive card grid, auto-fitting columns (min ~280–320px), collapses to one column on narrow screens.
- Detail: fryer taskbar on top, then a horizontal row of the 4 stage cards, then the sensor grid.
- Content sits on the neutral canvas with comfortable outer padding.

## Anti-patterns

- No blocking `alert()` — use toasts.
- No color-only status.
- Don't overload the overview card — it's a glance, not the full detail.
- Don't broadcast every machine's stream to every view; subscribe only to what's on screen.
- Don't invent new accent colors outside the value palette above.
