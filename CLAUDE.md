# CLAUDE.md

Guidance for AI assistants working in this repository.

## Project Overview

A web-based **3-DOF robotic arm simulator** demonstrating Mechatronics concepts:
inverse kinematics (IK), finite-state-machine (FSM) automation, waypoint
teach/replay, and real-time telemetry. It is a single-page Next.js app rendered
entirely client-side with React Three Fiber (Three.js).

There is no backend, database, or API — all simulation logic runs in the browser
inside the R3F render loop.

## Tech Stack

- **Next.js 16** (App Router) + **React 19** with the React Compiler enabled
  (`reactCompiler: true` in `next.config.ts`).
- **TypeScript 5** (`strict: true`).
- **React Three Fiber** (`@react-three/fiber`) + **drei** (`@react-three/drei`) over **Three.js** for 3D.
- **zustand** for all simulation/UI state (`store/robotStore.ts`).
- **Recharts** for the live telemetry graph.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`; imported in `app/globals.css`) for the 2D HUD/overlay.
- `uuid` is installed but **not currently used**.

## Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server at http://localhost:3000
npm run build      # production build (also the best full type-check across the app)
npm run start      # serve the production build
npm run lint       # ESLint (flat config, eslint-config-next)
```

There is **no test suite** and no test runner configured. Do not claim tests pass
— verify changes with `npm run build` and by exercising the app in the browser.

## Architecture & Key Files

```
app/
  layout.tsx      Root layout; Geist fonts + globals.css. (metadata still says "Create Next App".)
  page.tsx        Thin composition: <Canvas> + scene components + <Hud> DOM overlay.
  globals.css     Tailwind v4 import + light/dark CSS variables.
store/
  robotStore.ts   THE core. Zustand store: all state, all actions, and tick() —
                  the per-frame sim step (lerp, telemetry, AUTO_PICK FSM, replay).
                  Also exports BLOCKS config, GRAB_RANGE, CARRY_OFFSET_Y, types.
components/
  RobotArm.tsx    3D arm model: PBR metal materials, RoundedBox limbs, animated
                  gripper fingers, drei <Trail> on the wrist. Joint rotations
                  written onto group refs each frame from store sim state —
                  zero React re-renders per frame.
  scene/          Everything rendered inside the Canvas:
    SimulationLoop.tsx     null component; calls store.tick(delta) via useFrame
    Block.tsx              physics-lite cube (gravity/floor); follows gripper
                           when attached; reports live position to the store;
                           click sends the arm hovering above it
    DropZones.tsx          zone rings driven by the store's ZONES config, with
                           carried-block hover glow + one-shot delivery pulse
    CameraRig.tsx          flies the camera to store cameraGoal presets, then
                           hands control back to OrbitControls
    WaypointVisualizer.tsx dashed path + numbered spheres for waypoints
    TargetControl.tsx      TransformControls gizmo (MANUAL + IK control only).
                           Bidirectional sync: drags feed moveTarget(); when not
                           dragging, a useFrame copies sim.ikTarget onto the
                           gizmo so click/keyboard/reset moves reposition it
    TargetMarker.tsx       always-visible glowing sphere at the IK target;
                           amber while the target is clamped to the boundary
    WorkspaceEnvelope.tsx  translucent reach dome + floor boundary ring
    ClickToMove.tsx        invisible ground plane; click → move target there
    KeyboardControls.tsx   WASD/QE target nudge (camera-relative), G grip,
                           R record, Space replay
  hud/            The 2D overlay — plain DOM sibling of the Canvas, NOT drei <Html>:
    Hud.tsx                layout + Diagnostics/Coordinates/Proximity/ControlMode
                           panels, FK sliders, controls hint
    CommandDeck.tsx        bottom bar (collapsible): telemetry, operations, pendant
    AutoPhaseStepper.tsx   AUTO_PICK FSM progress dots (always rendered; lights
                           up during a run)
    TeachPendant.tsx       waypoint list (grip toggle / reorder / delete per row,
                           active-row highlight during replay) + save/load/clear
                           (localStorage key 'robot-arm-program') + REC/PLAY
    TelemetryChart.tsx     exports TelemetryPanel: velocity/torque graph with
                           value axis, latest readouts, HOLD/RUN toggle
    Toasts.tsx             transient event chips (auto-dismiss ~2.6s), top-center
utils/
  kinematics.ts   solveIK (geometric IK) + solveFK (forward kinematics) +
                  the arm dimensions L1/L2/L3 and MAX_REACH/MIN_REACH.
                  Pure, no dependencies.
```

### Control flow — how motion happens
1. A target position is written to `sim.ikTarget` via the store's `moveTarget`
   action — by dragging the gizmo, clicking the floor/a block, or WASD/QE keys
   (MANUAL+IK), or by the FSM / replay logic inside `tick()` (AUTO_PICK /
   REPLAY). In FK control mode, `setJointAngle` instead writes
   `sim.desiredAngles` directly and derives `sim.ikTarget` via `solveFK`.
2. `moveTarget` **clamps the target into the reachable workspace**
   (`clampTargetInPlace`: floor, outer reach sphere, inner dead zone) and sets
   the reactive `targetClamped` flag, then calls `solveIK` and stores the
   result in `sim.desiredAngles`. The FSM clamps its destinations the same way
   so arrival checks can always succeed — never compare distances against an
   unclamped destination.
3. Each frame, `SimulationLoop` calls `tick(delta)`, which **lerps**
   `sim.smoothAngles` toward `sim.desiredAngles` (factor `0.1`).
4. `RobotArm`'s `useFrame` reads `sim.smoothAngles` and writes them directly
   onto the joint group refs — no React re-render involved.

### State model — the critical convention
The store has **two kinds of state**; keeping them straight is the whole point
of the architecture:

- **Reactive state** (`mode`, `isGripping`, `waypoints`, `telemetry`, `toasts`,
  `hudAngles`, …) — updated via `set()`, subscribed from components with
  **narrow selectors** (`useRobotStore((s) => s.mode)`). HUD readouts
  (`hudAngles`, `hudTarget`, `minBlockDist`) are throttled snapshots refreshed
  every 5th frame (~12Hz), alongside telemetry (which additionally respects
  `telemetryPaused`). User-facing events go through the store's `pushToast` —
  emit toasts from store actions, not from components.
- **`sim` — mutable per-frame data** (`ikTarget`, `smoothAngles`,
  `desiredAngles`, `blockPositions`, …) — mutated in place inside `tick()` and
  read transiently via `useRobotStore.getState().sim` inside `useFrame`
  callbacks. **Never subscribe to `sim` from React** — that would re-render at
  60fps, which is exactly the perf problem this design removed.

### Operating modes (`mode` state)
- `MANUAL` — drag the gizmo / click / keyboard to move the arm; GRAB/RELEASE
  and the teach pendant work here. Sub-mode `controlMode`: IK target vs FK sliders.
- `AUTO_PICK` (labeled **AUTO SORT** in the UI) — an FSM (`autoPhase`) cycles
  `IDLE → APPROACH → DESCEND → LIFT → MOVE_TO_ZONE → LOWER_TO_DROP → IDLE`,
  where `IDLE` selects the next block not resting in its assigned zone
  (`BlockConfig.zoneId`) and delivers it there; when none remain it runs
  `RETRACT` and returns to MANUAL.
- `REPLAY` — plays back recorded waypoints in a loop, re-applying grip state at each point.

### Mission
The standing objective is "sort every block into its matching zone"
(`BLOCKS[i].zoneId` ↔ `ZONES[i].id`). `tick()`'s throttled section tracks
`sortedBlockIds` (a block counts as sorted when resting — `y < 1` — inside its
zone), a live `missionTime`, `missionComplete`, and `missionBestTime`
(persisted to localStorage `'robot-arm-best-time'`; hydrated client-side via
`hydrateBestTime` to avoid SSR hydration mismatch). Manual and autonomous
sorting both count. Reset restarts the mission but keeps the best time.

## Conventions

- **Client components only.** Every component file starts with `'use client'`.
  Anything touching R3F hooks (`useFrame`), browser APIs, or interactive state
  must be a client component.
- **Per-frame values never go through React state.** Use the store's `sim`
  object (or local `useRef` for component-private data like block physics).
  Putting per-frame values in `useState`/reactive store fields causes render
  thrashing.
- **Robot dimensions are single-sourced** in `utils/kinematics.ts` (`L1/L2/L3`,
  1 / 3 / 2.5) and imported by `RobotArm.tsx` and `WorkspaceEnvelope.tsx` —
  change them there only.
- **Everything the arm interacts with must be reachable**: within `MAX_REACH`
  (5.5) of the shoulder pivot `(0, 1, 0)` — including the FSM's approach point
  2 units above a block. Unreachable requests get clamped, so a block placed
  outside reach can never be picked.
- **All gripper releases must go through the store's `releaseAttached` helper**
  — it detects zone deliveries (pulse + toast) vs plain releases. Never set
  `attachedBlockId: null` directly.
- **`moveTowards` clamps its step to the remaining distance.** Never re-introduce
  overshoot: with AUTO_SPEED at 60fps the step ≈ ARRIVE_THRESHOLD, so an
  overshooting target oscillates around the destination and arrival checks
  become frame-timing dependent (this was a real stall bug).
- **Lighting is fully procedural** (`Environment` + `Lightformer` in
  `page.tsx`). Do not use `Environment preset="..."` — presets fetch HDRs from
  a CDN at runtime and break offline.
- Drop zones and camera views are config: `ZONES`/`ZONE_RADIUS` and
  `CAMERA_PRESETS` in the store.
- **Angles are radians internally**, converted to degrees only in the HUD
  (`RAD2DEG` in `Hud.tsx`).
- **`solveIK` returns `null` when the target is unreachable** (`h > L2 + L3`).
  Callers must null-check before using the solution (see the store's
  `moveTarget`) — never assume a solution exists.
- **Styling:** 3D via R3F/Three.js. The 2D HUD is a plain DOM overlay
  (`pointer-events-none` container, `pointer-events-auto` panels) — only
  3D-anchored labels (block IDs, zone names, waypoint numbers) use drei
  `<Html>`. The aesthetic is a dark "mission control" HUD (slate/cyan/amber,
  `font-mono`).
- Imports use the `@/*` alias (maps to repo root, see `tsconfig.json`).

## Development Workflow

- Default branch is `main`. Do all work on the designated feature branch, commit
  with clear messages, and push to that branch. Do not open a pull request unless
  explicitly asked.
- After code changes, run `npm run build` and `npm run lint` before committing.
- `.idea/` (JetBrains) is committed; leave it alone unless asked.

## Verifying Changes

Use the project verify skill (`.claude/skills/verify/SKILL.md`): run the dev
server and drive the app headlessly with Playwright. All app state (mode,
coordinates, waypoint count) is readable from the HUD text; collect browser
console errors — R3F fails silently to the console.

## Known Rough Edges / Gotchas

- In `Block`, pass vector coordinates individually (`data.initialPos[0]`, `[1]`,
  `[2]`) rather than spreading the tuple — spreading broke TS inference before.
- The gravity/collision in `Block` is a simple hand-rolled approximation (floor
  at `y = 0.5`), not a physics engine.
- Block ID 1 spawns at `(3.5, 0.5, 3.5)`, partially hidden behind the bottom
  command deck at the default camera — a missing-looking block is not a render bug.
- FK sliders can command poses below the floor — there is no arm/floor
  collision. Deliberate for now (joint control is "honest").
- Responsive behavior: side HUD panels hide below `sm`; the deck reduces to the
  operations column below `md`. The desktop layout is the primary target.
