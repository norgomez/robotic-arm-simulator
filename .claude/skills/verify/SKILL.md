---
name: verify
description: Build, launch, and drive the robotic arm simulator to verify changes end-to-end in a real browser.
---

# Verifying the robotic arm simulator

## Build / launch

```bash
npm run build          # full type-check; Recharts "width(-1)" warning during prerender is harmless
npm run dev            # dev server on http://localhost:3000, ready in ~1s
```

## Drive (headless Chromium via Playwright)

Playwright is NOT a project dependency — install the library in a scratch dir
(`npm i playwright`; browser itself is preinstalled at `/opt/pw-browsers`,
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set).

Use a 1280x720 viewport. All app state is readable from the HUD via
`document.body.innerText`:

- `MODE: MANUAL|AUTO_PICK|REPLAY`
- Coordinates: regex `/X\s*([\d.-]+)\s*m\s*Y\s*([\d.-]+)\s*m\s*Z\s*([\d.-]+)\s*m/s`
- `POINTS: N` (waypoint count)

Flows worth driving:

1. **Manual IK**: drag the TransformControls gizmo. Its center XYZ handle sits at
   the IK target's projected screen position (initially world `(2,2,2)`). Compute
   the projection with three.js: camera pos `(8,8,8)`, fov 45, lookAt origin,
   aspect W/H. `mouse.down` there, move in ~6px steps, `mouse.up` → COORDINATES
   panel values change.
2. **AUTO PICK**: click the button, poll for `MODE: MANUAL` (completes in ~5-15s).
   Blue block (ID 1) should end up in Zone A; arm retracts to ~`(0,3,0)`.
3. **Teach pendant**: REC increments POINTS, PLAY → `MODE: REPLAY`, STOP → MANUAL.
   PLAY is disabled at 0 points.
4. **RESET SYSTEM**: coords back to `(2,2,2)`, points 0, blocks respawn.

Always collect `console`/`pageerror` events — R3F renders errors silently to
the console, not the page.

## Gotchas

- Wait ~3s after `networkidle` before interacting: the Canvas mounts client-side.
- Block ID 1 at `(4, 0.5, 4)` is initially hidden behind the bottom command deck
  at the default camera; don't assume a missing mesh means a render bug.
