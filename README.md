# Web-Based Robotic Arm Simulator

A 3-DOF robotic arm simulation built with **Next.js**, **React Three Fiber (Three.js)**, and **TypeScript**. It demonstrates core Mechatronics concepts — inverse & forward kinematics, FSM autonomy, teach-pendant programming, and real-time telemetry — wrapped in a mission-control style HUD.

## Features

* **Simulated PID joint servos:** Each joint is a PID-controlled damped plant with actuator saturation, a speed limit, anti-windup, and gravity load (heavier while carrying). Tune Kp/Ki/Kd live and watch commanded-vs-actual response — overshoot, ringing, sag, and settling — on the servo telemetry graph.
* **Inverse Kinematics (IK):** Geometric 3-DOF solver with workspace clamping — a visible reach envelope, a glowing target marker, and a REACH LIMIT warning when you push past the boundary.
* **Forward Kinematics (FK):** Switch to direct joint control with per-joint sliders; the end-effector target stays in sync.
* **Multiple input methods:** Drag the 3D gizmo, click the floor or a block to send the arm there, or drive with the keyboard (WASD/QE move, G grip, R record, Space replay).
* **Autonomous Sorting:** An FSM (with a live phase stepper) picks every unsorted block and delivers it to its matching zone, then retracts.
* **Mission & scoring:** Sort all blocks into their zones against a timer; best time persists between sessions.
* **Teach Pendant:** Record waypoint programs with grip actions, edit them (reorder / delete / toggle grip), replay in a loop, and save/load to browser storage.
* **Telemetry Dashboard:** Live joint velocity and simulated motor load with hold/run control (Recharts).
* **Polished 3D scene:** PBR metal arm with animated gripper fingers, motion trail, procedural environment lighting, contact shadows, zone hover/delivery effects, and camera presets (ISO/TOP/SIDE/FRONT).

## Tech Stack

* **Framework:** Next.js 16 / React 19 (React Compiler enabled)
* **3D Engine:** React Three Fiber + drei (Three.js)
* **State:** zustand (reactive UI state + non-reactive per-frame sim state)
* **Styling:** Tailwind CSS v4
* **Data Viz:** Recharts

## How to Run

1.  Clone the repo: `git clone https://github.com/norgomez/robotic-arm-simulator.git`
2.  Install dependencies: `npm install`
3.  Run the development server: `npm run dev`
4.  Open [http://localhost:3000](http://localhost:3000)

## Controls

| Input | Action |
| --- | --- |
| Drag gizmo / click floor / click block | Move the IK target |
| `W A S D` / `Q E` | Nudge target (camera-relative) / lower & raise |
| `G` | Grab / release |
| `R` | Record waypoint |
| `Space` | Play / stop waypoint replay |
| AUTO SORT | Autonomously sort all blocks into their zones |
