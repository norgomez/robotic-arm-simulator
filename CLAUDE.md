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
- **Recharts** for the live telemetry graph.
- **Tailwind CSS v4** (via `@tailwindcss/postcss`; imported in `app/globals.css`) for the 2D HUD/overlay.
- `zustand` and `uuid` are installed but **not currently used** — no global store exists yet; all state is local React state/refs.

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
  page.tsx        THE app. Canvas setup + all simulation logic and HUD. ~460 lines.
  globals.css     Tailwind v4 import + light/dark CSS variables.
components/
  RobotArm.tsx    Pure 3D model: nested <group> transforms driven by joint angles. No logic.
utils/
  kinematics.ts   solveIK(x,y,z) — geometric IK solver. Pure, no dependencies.
```

Everything of substance lives in **`app/page.tsx`**. It is intentionally
monolithic; when changing behavior, that is almost always the file to edit.

### `app/page.tsx` structure (top to bottom)
- `INITIAL_BLOCKS` — the pick-and-place blocks (id, initial position, color).
- `Block` — a physics-lite cube (gravity + floor collision) that follows the
  gripper when `attachedId` matches its id. Reports its live position up via
  `onPosUpdate` into `blockPositions` (a `Map` ref).
- `DropZones` — the static Zone A / Zone B ring markers.
- `WaypointVisualizer` — dashed line + numbered spheres for recorded waypoints.
- `RobotController` — **the core**. Owns all state and the single `useFrame`
  loop. Drives IK, angle smoothing, telemetry, the AUTO_PICK FSM, and REPLAY.
- Sub-components: `DataRow`, `RechartsLineChart`, `TargetControl`.
- `RobotPage` (default export) — `<Canvas>`, lights, grid, `OrbitControls`.

### Control flow — how motion happens
1. A target position (`ikTarget`, a `THREE.Vector3`) is set — by dragging the
   `TransformControls` gizmo (MANUAL), or programmatically (AUTO_PICK / REPLAY).
2. `handleTargetMove` calls `solveIK` and writes the result to the
   `desiredAngles` ref.
3. Each frame, `useFrame` **lerps** `smoothAngles` toward `desiredAngles`
   (factor `0.1`) for smooth motion, then passes `smoothAngles` to `<RobotArm>`.
4. `RobotArm` applies angles as nested group rotations to render the pose.

### Operating modes (`mode` state)
- `MANUAL` — drag the gizmo to move the arm; GRAB/RELEASE and the teach pendant work here.
- `AUTO_PICK` — an FSM (`autoPhase`) runs: `IDLE → APPROACH → DESCEND → LIFT →
  MOVE_TO_ZONE → LOWER_TO_DROP → RETRACT`, auto-picking a block and dropping it
  in Zone A, then returns to MANUAL.
- `REPLAY` — plays back recorded waypoints in a loop, re-applying grip state at each point.

## Conventions

- **Client components only.** `app/page.tsx` starts with `'use client'`. Anything
  touching R3F hooks (`useFrame`), browser APIs, or interactive state must be a
  client component.
- **Per-frame mutable state goes in refs, not `useState`.** Values that change
  every frame but shouldn't trigger React re-renders (`desiredAngles`,
  `blockPositions`, `prevAngles`, `frameCount`) are `useRef`. Follow this pattern
  — putting per-frame values in `useState` will cause render thrashing.
- **Robot dimensions are duplicated and must stay in sync.** `L1/L2/L3` in
  `utils/kinematics.ts` (1, 3, 2.5) must match `baseHeight/upperArmLength/
  forearmLength` in `components/RobotArm.tsx`. Changing the model geometry means
  updating both files or IK will be wrong.
- **Angles are radians internally**, converted to degrees for the HUD by
  multiplying by `57.29` (≈180/π).
- **`solveIK` returns `null` when the target is unreachable** (`h > L2 + L3`).
  Callers must null-check before assigning to `desiredAngles` (see
  `handleTargetMove`) — never assume a solution exists.
- **Styling:** 3D via R3F/Three.js; all 2D UI is Tailwind utility classes inside
  a drei `<Html fullscreen>` overlay. The aesthetic is a dark "mission control"
  HUD (slate/cyan/amber, `font-mono`).
- `any` is used liberally on component props in `page.tsx`. It's the existing
  house style here; prefer typing new code, but don't feel obligated to refactor
  untouched code to satisfy stricter typing.
- Import alias `@/*` maps to the repo root (see `tsconfig.json`).

## Development Workflow

- Default branch is `main`. Do all work on the designated feature branch, commit
  with clear messages, and push to that branch. Do not open a pull request unless
  explicitly asked.
- After code changes, run `npm run build` and `npm run lint` before committing.
- `.idea/` (JetBrains) is committed; leave it alone unless asked.

## Known Rough Edges / Gotchas

- `app/layout.tsx` metadata still reads "Create Next App" — update if asked to polish.
- The `Block` component predates a fix noted inline: pass vector coordinates
  individually (`data.initialPos[0]`, `[1]`, `[2]`) rather than spreading, to
  avoid a prior TypeScript spread error.
- AUTO_PICK always targets block id `1` (`targetBlockIdForAuto`) and always
  drops into Zone A hardcoded at `[-4, 3, 2]`. It is a demo, not a general planner.
- The gravity/collision in `Block` is a simple hand-rolled approximation (floor
  at `y = 0.5`), not a physics engine.
