# Web-Based Robotic Arm Simulator

A 3-DOF robotic arm simulation built with **Next.js**, **Three.js (R3F)**, and **TypeScript**. This project demonstrates core Mechatronics concepts including Inverse Kinematics, Finite State Machine (FSM) automation, and real-time telemetry visualization.

## Features

* **Inverse Kinematics (IK):** Geometric solution for 3-DOF arm positioning.
* **Trajectory Planning:** Linear interpolation (Lerp) for smooth joint motion and physics-based movement.
* **Autonomous Pick & Place:** A Finite State Machine (FSM) that autonomously plans paths to pick up objects and place them in a drop zone.
* **Telemetry Dashboard:** Real-time visualization of joint velocity and simulated motor torque/load using Recharts.
* **Interactive Controls:** Switch between Manual Joint Control, IK Mouse Control, and Full Autonomy.

## Tech Stack

* **Framework:** Next.js 14 / React
* **3D Engine:** React Three Fiber (Three.js)
* **Styling:** Tailwind CSS
* **Data Viz:** Recharts

## How to Run

1.  Clone the repo: `git clone https://github.com/YOUR_USERNAME/robotic-arm-simulator.git`
2.  Install dependencies: `npm install`
3.  Run the development server: `npm run dev`
4.  Open [http://localhost:3000](http://localhost:3000)