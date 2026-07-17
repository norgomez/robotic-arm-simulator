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
2. **Click-to-move**: `mouse.click` a projected floor point (MANUAL+IK only) →
   target moves to that x/z, keeping y. Clicking a block hovers 1 unit above it.
3. **Keyboard**: hold `w/a/s/d/q/e` (use `keyboard.down`/`up`, movement is
   per-frame) → coords glide; `g` grip, `r` record, Space replay toggle.
4. **Reach clamp**: hold `e` for ~2.5s → coords stop at 5.45 from `(0,1,0)` and
   the COORDINATES panel shows the text `REACH LIMIT` (sticky until the next
   in-range move).
5. **FK sliders**: click `JOINT FK` → three `role=slider` inputs (aria-labels
   "BASE/SHLDR/ELBOW joint angle"). Drive them with focus + ArrowLeft/Right —
   do NOT click the track (the thumb often sits where you'd click, a no-op).
   DIAGNOSTICS angles converge to the slider values; coords follow via FK.
6. **AUTO SORT** (button name changed from AUTO PICK): sorts EVERY unsorted
   block into its assigned zone (blue 1→A, red 2→B), then retracts. Poll for
   `MODE: MANUAL` (~10s for both blocks; deterministic). Expect `DELIVERED —
   ZONE A` and `— ZONE B`, `AUTO SEQUENCE COMPLETE`, and — when all blocks end
   sorted — `MISSION COMPLETE — N.Ns` (with `★ NEW BEST` when applicable).
   Clicking AUTO SORT when everything is sorted → `ALL BLOCKS ALREADY SORTED`
   toast, mode stays MANUAL. Blocks sorted manually beforehand are skipped.
6a. **Mission panel** (top-right): `MISSION: SORT BLOCKS`, per-block rows
   `BLK 1 → A` with ✓/○, `TIME N.Ns` (ticks while incomplete, freezes on
   completion), `BEST N.Ns` persisted across reloads (localStorage
   'robot-arm-best-time'). RESET clears checks/timer but keeps BEST.
6b. **Zone delivery**: releasing a carried block over a zone → `BLOCK N
   DELIVERED — ZONE X` toast + pulse ring; away from zones → `BLOCK N RELEASED`.
   Carrying over a zone lights it up (visual check).
6c. **Camera presets**: ISO/TOP/SIDE/FRONT buttons in the right HUD fly the
   camera (~1.5s); verify via screenshots.
6d. **Responsive**: at ≤ 640px width the side HUD panels hide; below 768px the
   deck shows only the operations column.
7. **Teach pendant**: REC increments `PTS: N`, PLAY → `MODE: REPLAY` (active row
   highlighted), STOP → MANUAL. Per-row buttons have aria-labels ("Move waypoint
   N up/down", "Delete waypoint N"); grip toggles read OPEN/GRIP. SAVE/LOAD/CLR
   persist via localStorage — assert their toasts.
8. **Toasts**: events surface as text in `document.body.innerText` for ~2.6s —
   `GRAB FAILED`, `BLOCK N GRIPPED`, `WAYPOINT N SET`, `AUTO SEQUENCE COMPLETE`,
   `PROGRAM SAVED/LOADED`, `SYSTEM RESET`. Assert promptly after the action.
9. **Stepper**: `APPR DESC LIFT MOVE DROP RETR` labels always in the deck;
   phases light up during AUTO_PICK (visual check via screenshot).
10. **Telemetry (SERVO)**: graphs commanded (dashed amber) vs actual (cyan)
    shoulder angle; `ERR n.n°` readout in the header. `⏸ HOLD` freezes graph
    sampling even while the arm moves; `▶ RUN` resumes. `▼ HIDE` collapses the
    deck to a slim bar.
10a. **PID tuning** (left HUD): sliders `role=slider` named "KP/KI/KD gain"
    (drive with focus + Home/End/arrows), DEFAULTS button restores 80/12/16.
    KP=200 + KI=KD=0 then a step → sustained ringing in ACT and a fluctuating
    ERR; defaults → smooth settle. Grabbing a block bumps ERR briefly (payload
    gravity sag).
11. **RESET SYSTEM**: coords back to `(2,2,2)`, points 0, blocks respawn, IK mode.

Always collect `console`/`pageerror` events — R3F renders errors silently to
the console, not the page.

## Gotchas

- Wait ~3s after `networkidle` before interacting: the Canvas mounts client-side.
- The headless renderer runs well below 60fps and tick() clamps dt, so SIM TIME
  RUNS SLOWER THAN WALL TIME. Never use fixed waits for arm motion — after a
  big move, poll `PROXIMITY` (or coordinates) until arrival before grabbing.
- Block ID 1 at `(3.5, 0.5, 3.5)` is initially mostly hidden behind the bottom
  command deck at the default camera; don't assume a missing mesh means a render bug.
