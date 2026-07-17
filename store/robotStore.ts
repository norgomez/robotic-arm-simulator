import { create } from 'zustand';
import * as THREE from 'three';
import { solveIK, solveFK, L1, MAX_REACH, MIN_REACH } from '@/utils/kinematics';

// ---------- Types ----------
export type JointAngles = { base: number; shoulder: number; elbow: number };
export type Mode = 'MANUAL' | 'AUTO_PICK' | 'REPLAY';
/** How the user commands the arm in MANUAL mode: IK target vs direct joints. */
export type ControlMode = 'IK' | 'FK';
export type AutoPhase =
    | 'IDLE'
    | 'APPROACH'
    | 'DESCEND'
    | 'LIFT'
    | 'MOVE_TO_ZONE'
    | 'LOWER_TO_DROP'
    | 'RETRACT';
export type Waypoint = { pos: THREE.Vector3; grip: boolean };
export type TelemetryPoint = { time: number; velocity: number; torque: number };
export type BlockConfig = { id: number; initialPos: [number, number, number]; color: string };

// ---------- Scene / simulation config ----------
// NOTE: spawn positions must be reachable — inside MAX_REACH of the shoulder
// pivot (0, L1, 0) including the FSM's approach point 2 units above the block.
export const BLOCKS: BlockConfig[] = [
    { id: 1, initialPos: [3.5, 0.5, 3.5], color: '#3b82f6' }, // Blue
    { id: 2, initialPos: [4, 0.5, -2], color: '#ef4444' }, // Red
];

/** Max distance from the IK target at which a block can be grabbed. */
export const GRAB_RANGE = 1.5;
/** Vertical offset from the IK target to where a carried block hangs. */
export const CARRY_OFFSET_Y = -0.75;

const HOME_TARGET = new THREE.Vector3(2, 2, 2);
const SHOULDER_PIVOT = new THREE.Vector3(0, L1, 0);
const REACH_MAX = MAX_REACH - 0.05; // margin keeps solveIK comfortably solvable
const JOINT_LERP = 0.1; // per-frame interpolation factor toward the IK solution
const AUTO_SPEED = 6; // units/sec in AUTO_PICK
const REPLAY_SPEED = 4; // units/sec in REPLAY
const ARRIVE_THRESHOLD = 0.1; // distance considered "arrived" at a destination
const HUD_SAMPLE_EVERY_N_FRAMES = 5; // ~12Hz at 60fps: telemetry + HUD readout rate
const TELEMETRY_WINDOW = 40;

const lerp = (start: number, end: number, t: number) => start + (end - start) * t;

/**
 * Clamp a requested target into the reachable workspace (mutates `p`).
 * Returns true if the point had to be moved: above the floor, inside the
 * outer reach sphere, and outside the inner singularity dead zone.
 */
const clampTargetInPlace = (p: THREE.Vector3): boolean => {
    let clamped = false;
    if (p.y < 0) {
        p.y = 0;
        clamped = true;
    }
    const offset = p.clone().sub(SHOULDER_PIVOT);
    const dist = offset.length();
    if (dist < 1e-6) offset.set(0, 1, 0);
    else offset.normalize();

    if (dist > REACH_MAX) {
        p.copy(SHOULDER_PIVOT).addScaledVector(offset, REACH_MAX);
        if (p.y < 0) p.y = 0; // floor wins over the sphere surface
        clamped = true;
    } else if (dist < MIN_REACH) {
        p.copy(SHOULDER_PIVOT).addScaledVector(offset, MIN_REACH);
        clamped = true;
    }
    return clamped;
};

/**
 * Mutable per-frame simulation data. These objects are mutated in place inside
 * `tick()` and read transiently (`useRobotStore.getState().sim`) inside
 * `useFrame` callbacks. They are intentionally NOT reactive — never subscribe
 * to them from React, or you'll re-render at 60fps.
 */
interface SimData {
    /** Current IK target (gripper goal). Mutated in place. */
    ikTarget: THREE.Vector3;
    /** Smoothed joint angles actually rendered (radians). */
    smoothAngles: JointAngles;
    /** Raw IK solution the arm is lerping toward (radians). */
    desiredAngles: JointAngles;
    prevShoulder: number;
    frameCount: number;
    /** Live block positions, reported by Block components each frame. */
    blockPositions: Map<number, THREE.Vector3>;
    /** Which block AUTO_PICK goes for. */
    autoTargetBlockId: number;
}

interface RobotStore {
    // --- Reactive state: subscribe with narrow selectors ---
    mode: Mode;
    controlMode: ControlMode;
    /** True while the requested IK target is being clamped to the workspace edge. */
    targetClamped: boolean;
    /** Joint angles commanded by the FK sliders (radians). */
    fkAngles: JointAngles;
    autoPhase: AutoPhase;
    isGripping: boolean;
    attachedBlockId: number | null;
    waypoints: Waypoint[];
    replayIndex: number;
    telemetry: TelemetryPoint[];
    /** Bumped on reset; components key/effect off it to restore initial state. */
    resetKey: number;
    // Throttled snapshots for HUD readouts (updated ~12Hz, not 60fps)
    hudAngles: JointAngles;
    hudTarget: { x: number; y: number; z: number };
    minBlockDist: number;

    // --- Non-reactive per-frame data (read via getState() in useFrame) ---
    sim: SimData;

    // --- Actions ---
    /** Set the IK target (clamped into the workspace) and solve for joint angles. */
    moveTarget: (pos: THREE.Vector3) => void;
    /** Switch between IK-target and direct-joint (FK) control in MANUAL mode. */
    setControlMode: (m: ControlMode) => void;
    /** FK mode: command one joint directly; the target follows via forward kinematics. */
    setJointAngle: (joint: keyof JointAngles, radians: number) => void;
    tryGrabClosest: () => void;
    toggleGripper: () => void;
    startAutoPick: () => void;
    recordWaypoint: () => void;
    toggleReplay: () => void;
    reset: () => void;
    reportBlockPosition: (id: number, pos: THREE.Vector3) => void;
    /** Advance the simulation one frame. Called from SimulationLoop's useFrame. */
    tick: (delta: number) => void;
}

export const useRobotStore = create<RobotStore>()((set, get) => {
    /** Step the IK target toward `dest` at `step` units (already delta-scaled). */
    const moveTowards = (dest: THREE.Vector3, step: number) => {
        const { sim, moveTarget } = get();
        const dir = new THREE.Vector3().subVectors(dest, sim.ikTarget).normalize();
        moveTarget(sim.ikTarget.clone().add(dir.multiplyScalar(step)));
    };

    return {
        mode: 'MANUAL',
        controlMode: 'IK',
        targetClamped: false,
        fkAngles: { base: 0, shoulder: 0, elbow: 0 },
        autoPhase: 'IDLE',
        isGripping: false,
        attachedBlockId: null,
        waypoints: [],
        replayIndex: 0,
        telemetry: [],
        resetKey: 0,
        hudAngles: { base: 0, shoulder: 0, elbow: 0 },
        hudTarget: { x: HOME_TARGET.x, y: HOME_TARGET.y, z: HOME_TARGET.z },
        minBlockDist: 0,

        sim: {
            ikTarget: HOME_TARGET.clone(),
            smoothAngles: { base: 0, shoulder: 0, elbow: 0 },
            desiredAngles: { base: 0, shoulder: 0, elbow: 0 },
            prevShoulder: 0,
            frameCount: 0,
            blockPositions: new Map<number, THREE.Vector3>(),
            autoTargetBlockId: 1,
        },

        moveTarget: (pos) => {
            const { sim } = get();
            // Copy first, then clamp — never mutate the caller's vector (it may
            // be the TransformControls gizmo's live position mid-drag).
            sim.ikTarget.copy(pos);
            const clamped = clampTargetInPlace(sim.ikTarget);
            if (clamped !== get().targetClamped) set({ targetClamped: clamped });
            const solution = solveIK(sim.ikTarget.x, sim.ikTarget.y, sim.ikTarget.z);
            if (solution) {
                sim.desiredAngles.base = solution.base;
                sim.desiredAngles.shoulder = solution.shoulder;
                sim.desiredAngles.elbow = solution.elbow;
            }
        },

        setControlMode: (m) => {
            const { sim } = get();
            if (m === 'FK') {
                // Seed the sliders from the current commanded pose, and sync the
                // target to it so grabbing/proximity/waypoints keep working.
                const d = { ...sim.desiredAngles };
                const fk = solveFK(d.base, d.shoulder, d.elbow);
                sim.ikTarget.set(fk.x, fk.y, fk.z);
                set({ controlMode: 'FK', fkAngles: d, targetClamped: false });
            } else {
                set({ controlMode: 'IK' });
            }
        },

        setJointAngle: (joint, radians) => {
            const { sim } = get();
            sim.desiredAngles[joint] = radians;
            const d = sim.desiredAngles;
            const fk = solveFK(d.base, d.shoulder, d.elbow);
            sim.ikTarget.set(fk.x, fk.y, fk.z);
            set((s) => ({ fkAngles: { ...s.fkAngles, [joint]: radians } }));
        },

        tryGrabClosest: () => {
            const { sim } = get();
            set({ isGripping: true });
            let closestId: number | null = null;
            let minDist = GRAB_RANGE;
            sim.blockPositions.forEach((pos, id) => {
                const dist = sim.ikTarget.distanceTo(pos);
                if (dist < minDist) {
                    minDist = dist;
                    closestId = id;
                }
            });
            if (closestId !== null) set({ attachedBlockId: closestId });
        },

        toggleGripper: () => {
            if (get().attachedBlockId !== null) {
                set({ attachedBlockId: null, isGripping: false });
            } else {
                get().tryGrabClosest();
            }
        },

        startAutoPick: () => {
            if (get().mode !== 'MANUAL') return;
            // Autonomous modes drive the IK target, so leave FK control
            set({ mode: 'AUTO_PICK', autoPhase: 'IDLE', controlMode: 'IK' });
        },

        recordWaypoint: () => {
            const { sim } = get();
            set((s) => ({
                waypoints: [...s.waypoints, { pos: sim.ikTarget.clone(), grip: s.isGripping }],
            }));
        },

        toggleReplay: () => {
            const s = get();
            if (s.mode === 'REPLAY') set({ mode: 'MANUAL' });
            else if (s.waypoints.length > 0) set({ mode: 'REPLAY', replayIndex: 0, controlMode: 'IK' });
        },

        reset: () => {
            const { sim } = get();
            sim.ikTarget.copy(HOME_TARGET);
            set((s) => ({
                mode: 'MANUAL',
                controlMode: 'IK',
                targetClamped: false,
                fkAngles: { base: 0, shoulder: 0, elbow: 0 },
                autoPhase: 'IDLE',
                isGripping: false,
                attachedBlockId: null,
                waypoints: [],
                replayIndex: 0,
                resetKey: s.resetKey + 1,
                hudTarget: { x: HOME_TARGET.x, y: HOME_TARGET.y, z: HOME_TARGET.z },
            }));
        },

        reportBlockPosition: (id, pos) => {
            const { blockPositions } = get().sim;
            const stored = blockPositions.get(id);
            if (stored) stored.copy(pos);
            else blockPositions.set(id, pos.clone());
        },

        tick: (delta) => {
            const { sim } = get();

            // 1. Smoothly interpolate rendered joint angles toward the IK solution
            const a = sim.smoothAngles;
            const d = sim.desiredAngles;
            a.base = lerp(a.base, d.base, JOINT_LERP);
            a.shoulder = lerp(a.shoulder, d.shoulder, JOINT_LERP);
            a.elbow = lerp(a.elbow, d.elbow, JOINT_LERP);

            // 2. Telemetry + throttled HUD snapshots (~12Hz)
            sim.frameCount++;
            if (sim.frameCount % HUD_SAMPLE_EVERY_N_FRAMES === 0) {
                const velocity = Math.abs((a.shoulder - sim.prevShoulder) / delta);
                // Simulated motor load: gravity moment on the shoulder + payload
                const torque = Math.abs(Math.cos(a.shoulder) + (get().attachedBlockId ? 1.5 : 0));

                let minDist = Infinity;
                sim.blockPositions.forEach((pos) => {
                    const dist = sim.ikTarget.distanceTo(pos);
                    if (dist < minDist) minDist = dist;
                });

                set((s) => {
                    const telemetry = [...s.telemetry, { time: sim.frameCount, velocity, torque }];
                    if (telemetry.length > TELEMETRY_WINDOW) telemetry.shift();
                    return {
                        telemetry,
                        hudAngles: { base: a.base, shoulder: a.shoulder, elbow: a.elbow },
                        hudTarget: { x: sim.ikTarget.x, y: sim.ikTarget.y, z: sim.ikTarget.z },
                        minBlockDist: Number.isFinite(minDist) ? minDist : 0,
                    };
                });
            }
            sim.prevShoulder = a.shoulder;

            // 3. Autonomous pick & place FSM
            if (get().mode === 'AUTO_PICK') {
                const { autoPhase } = get();
                const step = AUTO_SPEED * delta;
                const dest = new THREE.Vector3();
                let nextPhase: AutoPhase = autoPhase;
                const blockPos =
                    sim.blockPositions.get(sim.autoTargetBlockId) ?? new THREE.Vector3(3.5, 0.5, 3.5);

                // Clamp destinations into the workspace so arrival checks can
                // always succeed — an unreachable waypoint (e.g. a block dropped
                // near the boundary) would otherwise stall the FSM forever.
                const setDest = (x: number, y: number, z: number) => {
                    dest.set(x, y, z);
                    clampTargetInPlace(dest);
                };

                switch (autoPhase) {
                    case 'IDLE':
                        nextPhase = 'APPROACH';
                        break;
                    case 'APPROACH':
                        setDest(blockPos.x, blockPos.y + 2, blockPos.z);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) nextPhase = 'DESCEND';
                        break;
                    case 'DESCEND':
                        setDest(blockPos.x, blockPos.y, blockPos.z);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) {
                            set({ isGripping: true, attachedBlockId: sim.autoTargetBlockId });
                            nextPhase = 'LIFT';
                        }
                        break;
                    case 'LIFT':
                        setDest(blockPos.x, 3, blockPos.z);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) nextPhase = 'MOVE_TO_ZONE';
                        break;
                    case 'MOVE_TO_ZONE':
                        setDest(-4, 3, 2); // above Zone A
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) nextPhase = 'LOWER_TO_DROP';
                        break;
                    case 'LOWER_TO_DROP':
                        setDest(-4, 0.8, 2);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) {
                            set({ isGripping: false, attachedBlockId: null });
                            nextPhase = 'RETRACT';
                        }
                        break;
                    case 'RETRACT':
                        setDest(0, 3, 0);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) {
                            set({ mode: 'MANUAL', autoPhase: 'IDLE' });
                        }
                        break;
                }

                if (autoPhase !== 'IDLE') moveTowards(dest, step);
                if (nextPhase !== autoPhase) set({ autoPhase: nextPhase });
            }

            // 4. Waypoint replay
            if (get().mode === 'REPLAY') {
                const { waypoints, replayIndex, isGripping } = get();
                if (waypoints.length === 0) {
                    set({ mode: 'MANUAL' });
                    return;
                }
                const wp = waypoints[replayIndex];
                moveTowards(wp.pos, REPLAY_SPEED * delta);

                if (sim.ikTarget.distanceTo(wp.pos) < ARRIVE_THRESHOLD) {
                    if (wp.grip !== isGripping) {
                        if (wp.grip) get().tryGrabClosest();
                        else set({ isGripping: false, attachedBlockId: null });
                    }
                    set({ replayIndex: (replayIndex + 1) % waypoints.length });
                }
            }
        },
    };
});
