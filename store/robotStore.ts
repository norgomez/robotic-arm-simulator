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
export type BlockConfig = {
    id: number;
    initialPos: [number, number, number];
    color: string;
    /** The zone this block belongs in — the mission goal and AUTO SORT target. */
    zoneId: string;
};
export type ToastKind = 'info' | 'success' | 'warn';
export type Toast = { id: number; text: string; kind: ToastKind };

// ---------- Scene / simulation config ----------
// NOTE: spawn positions must be reachable — inside MAX_REACH of the shoulder
// pivot (0, L1, 0) including the FSM's approach point 2 units above the block.
export const BLOCKS: BlockConfig[] = [
    { id: 1, initialPos: [3.5, 0.5, 3.5], color: '#3b82f6', zoneId: 'A' }, // Blue → cyan zone
    { id: 2, initialPos: [4, 0.5, -2], color: '#ef4444', zoneId: 'B' }, // Red → orange zone
];

export type ZoneConfig = { id: string; center: [number, number]; color: string };
export const ZONES: ZoneConfig[] = [
    { id: 'A', center: [-4, 2], color: '#06b6d4' }, // Cyan
    { id: 'B', center: [-4, -2], color: '#f97316' }, // Orange
];
export const ZONE_RADIUS = 1.2;

export const CAMERA_PRESETS = {
    ISO: [8, 8, 8],
    TOP: [0.01, 16, 0.01],
    SIDE: [13, 4, 0],
    FRONT: [0, 4, 13],
} as const;
export type CameraPresetName = keyof typeof CAMERA_PRESETS;

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
const MAX_TOASTS = 4;
const PROGRAM_STORAGE_KEY = 'robot-arm-program';
const BEST_TIME_STORAGE_KEY = 'robot-arm-best-time';
/** A block above this height is being carried, not resting in a zone. */
const SORTED_MAX_Y = 1;

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
    /** Mission timer origin (Date.now()); reset restarts it. */
    missionStartAt: number;
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
    telemetryPaused: boolean;
    /** Transient event notifications; auto-dismissed by the Toasts component. */
    toasts: Toast[];
    /** Zone currently under a carried block (hover highlight), else null. */
    hoverZoneId: string | null;
    /** One-shot drop-success animation trigger; key bumps per delivery. */
    zonePulse: { zoneId: string; key: number } | null;
    /** Pending camera fly-to; key bumps so re-picking a preset re-triggers. */
    cameraGoal: { pos: [number, number, number]; key: number } | null;
    // --- Mission (sort every block into its matching zone) ---
    /** Ids of blocks currently resting in their assigned zones. */
    sortedBlockIds: number[];
    /** Elapsed mission seconds (live; frozen at the final time on completion). */
    missionTime: number;
    missionComplete: boolean;
    /** Best completion time in seconds (persisted to localStorage), if any. */
    missionBestTime: number | null;
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
    // Waypoint program editing (MANUAL mode only; buttons enforce, store re-guards)
    deleteWaypoint: (index: number) => void;
    toggleWaypointGrip: (index: number) => void;
    moveWaypoint: (index: number, dir: -1 | 1) => void;
    clearWaypoints: () => void;
    /** Persist / restore the waypoint program via localStorage. */
    saveProgram: () => void;
    loadProgram: () => void;
    pushToast: (text: string, kind?: ToastKind) => void;
    dismissToast: (id: number) => void;
    toggleTelemetryPaused: () => void;
    /** Fly the camera to a named preset view. */
    setCameraPreset: (name: CameraPresetName) => void;
    /** Load the persisted best time (client-only; call from a mount effect). */
    hydrateBestTime: () => void;
    reset: () => void;
    reportBlockPosition: (id: number, pos: THREE.Vector3) => void;
    /** Advance the simulation one frame. Called from SimulationLoop's useFrame. */
    tick: (delta: number) => void;
}

export const useRobotStore = create<RobotStore>()((set, get) => {
    /**
     * Step the IK target toward `dest` at `step` units (already delta-scaled).
     * The step is clamped to the remaining distance — overshooting would make
     * the target oscillate around `dest` and arrival checks frame-timing
     * dependent (step at 60fps ≈ ARRIVE_THRESHOLD).
     */
    const moveTowards = (dest: THREE.Vector3, step: number) => {
        const { sim, moveTarget } = get();
        const remaining = sim.ikTarget.distanceTo(dest);
        if (remaining <= step) {
            moveTarget(dest.clone());
            return;
        }
        const dir = new THREE.Vector3().subVectors(dest, sim.ikTarget).multiplyScalar(step / remaining);
        moveTarget(sim.ikTarget.clone().add(dir));
    };

    let toastSeq = 0;
    const pushToast = (text: string, kind: ToastKind = 'info') => {
        set((s) => {
            const toasts = [...s.toasts, { id: ++toastSeq, text, kind }];
            while (toasts.length > MAX_TOASTS) toasts.shift();
            return { toasts };
        });
    };

    /** Which drop zone (if any) is under this position, by horizontal distance. */
    const zoneIdAt = (pos: THREE.Vector3): string | null => {
        for (const z of ZONES) {
            const dx = pos.x - z.center[0];
            const dz = pos.z - z.center[1];
            if (Math.sqrt(dx * dx + dz * dz) <= ZONE_RADIUS) return z.id;
        }
        return null;
    };

    /** Is this block resting in its assigned zone? */
    const isBlockSorted = (block: BlockConfig): boolean => {
        const pos = get().sim.blockPositions.get(block.id);
        return !!pos && pos.y < SORTED_MAX_Y && zoneIdAt(pos) === block.zoneId;
    };

    /** The next block AUTO SORT should go for, if any. */
    const nextUnsortedBlock = (): BlockConfig | null =>
        BLOCKS.find((b) => !isBlockSorted(b)) ?? null;

    /**
     * Open the gripper, detaching any carried block. If the block lands in a
     * drop zone, fire the delivery pulse + toast; otherwise a plain release.
     */
    const releaseAttached = () => {
        const id = get().attachedBlockId;
        set({ attachedBlockId: null, isGripping: false });
        if (id === null) return;
        const pos = get().sim.blockPositions.get(id);
        const zone = pos ? zoneIdAt(pos) : null;
        if (zone) {
            set((s) => ({ zonePulse: { zoneId: zone, key: (s.zonePulse?.key ?? 0) + 1 } }));
            pushToast(`BLOCK ${id} DELIVERED — ZONE ${zone}`, 'success');
        } else {
            pushToast(`BLOCK ${id} RELEASED`);
        }
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
        telemetryPaused: false,
        toasts: [],
        hoverZoneId: null,
        zonePulse: null,
        cameraGoal: null,
        sortedBlockIds: [],
        missionTime: 0,
        missionComplete: false,
        missionBestTime: null,
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
            missionStartAt: Date.now(),
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
            if (closestId !== null) {
                set({ attachedBlockId: closestId });
                pushToast(`BLOCK ${closestId} GRIPPED`, 'success');
            } else {
                pushToast('GRAB FAILED — NO BLOCK IN RANGE', 'warn');
            }
        },

        toggleGripper: () => {
            if (get().attachedBlockId !== null) releaseAttached();
            else get().tryGrabClosest();
        },

        startAutoPick: () => {
            if (get().mode !== 'MANUAL') return;
            if (!nextUnsortedBlock()) {
                pushToast('ALL BLOCKS ALREADY SORTED');
                return;
            }
            // Autonomous modes drive the IK target, so leave FK control
            set({ mode: 'AUTO_PICK', autoPhase: 'IDLE', controlMode: 'IK' });
        },

        recordWaypoint: () => {
            const { sim } = get();
            set((s) => ({
                waypoints: [...s.waypoints, { pos: sim.ikTarget.clone(), grip: s.isGripping }],
            }));
            pushToast(`WAYPOINT ${get().waypoints.length} SET`);
        },

        deleteWaypoint: (index) => {
            if (get().mode === 'REPLAY') return;
            set((s) => ({ waypoints: s.waypoints.filter((_, i) => i !== index) }));
        },

        toggleWaypointGrip: (index) => {
            if (get().mode === 'REPLAY') return;
            set((s) => ({
                waypoints: s.waypoints.map((wp, i) => (i === index ? { ...wp, grip: !wp.grip } : wp)),
            }));
        },

        moveWaypoint: (index, dir) => {
            if (get().mode === 'REPLAY') return;
            set((s) => {
                const target = index + dir;
                if (target < 0 || target >= s.waypoints.length) return s;
                const waypoints = [...s.waypoints];
                [waypoints[index], waypoints[target]] = [waypoints[target], waypoints[index]];
                return { waypoints };
            });
        },

        clearWaypoints: () => {
            if (get().mode === 'REPLAY') return;
            set({ waypoints: [], replayIndex: 0 });
            pushToast('PROGRAM CLEARED');
        },

        saveProgram: () => {
            const { waypoints } = get();
            if (waypoints.length === 0) {
                pushToast('NOTHING TO SAVE', 'warn');
                return;
            }
            try {
                const data = waypoints.map((wp) => ({ pos: [wp.pos.x, wp.pos.y, wp.pos.z], grip: wp.grip }));
                localStorage.setItem(PROGRAM_STORAGE_KEY, JSON.stringify(data));
                pushToast(`PROGRAM SAVED (${waypoints.length} PTS)`, 'success');
            } catch {
                pushToast('SAVE FAILED', 'warn');
            }
        },

        loadProgram: () => {
            if (get().mode === 'REPLAY') return;
            try {
                const raw = localStorage.getItem(PROGRAM_STORAGE_KEY);
                if (!raw) {
                    pushToast('NO SAVED PROGRAM', 'warn');
                    return;
                }
                const data: unknown = JSON.parse(raw);
                if (!Array.isArray(data) || data.length === 0) throw new Error('empty');
                const waypoints: Waypoint[] = data.map((entry) => {
                    const { pos, grip } = entry as { pos: unknown; grip: unknown };
                    if (!Array.isArray(pos) || pos.length !== 3 || !pos.every((n) => Number.isFinite(n))) {
                        throw new Error('bad waypoint');
                    }
                    const v = new THREE.Vector3(pos[0], pos[1], pos[2]);
                    clampTargetInPlace(v); // keep old programs valid if geometry changes
                    return { pos: v, grip: !!grip };
                });
                set({ waypoints, replayIndex: 0 });
                pushToast(`PROGRAM LOADED (${waypoints.length} PTS)`, 'success');
            } catch {
                pushToast('LOAD FAILED — CORRUPT DATA', 'warn');
            }
        },

        pushToast: (text, kind) => pushToast(text, kind),

        dismissToast: (id) => {
            set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        },

        toggleTelemetryPaused: () => set((s) => ({ telemetryPaused: !s.telemetryPaused })),

        setCameraPreset: (name) =>
            set((s) => ({
                cameraGoal: { pos: [...CAMERA_PRESETS[name]], key: (s.cameraGoal?.key ?? 0) + 1 },
            })),

        hydrateBestTime: () => {
            if (typeof window === 'undefined' || get().missionBestTime !== null) return;
            try {
                const stored = Number(localStorage.getItem(BEST_TIME_STORAGE_KEY));
                if (Number.isFinite(stored) && stored > 0) set({ missionBestTime: stored });
            } catch {
                /* localStorage unavailable — best time simply stays unset */
            }
        },

        toggleReplay: () => {
            const s = get();
            if (s.mode === 'REPLAY') set({ mode: 'MANUAL' });
            else if (s.waypoints.length > 0) set({ mode: 'REPLAY', replayIndex: 0, controlMode: 'IK' });
        },

        reset: () => {
            const { sim } = get();
            sim.ikTarget.copy(HOME_TARGET);
            sim.missionStartAt = Date.now();
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
                hoverZoneId: null,
                zonePulse: null,
                sortedBlockIds: [],
                missionTime: 0,
                missionComplete: false,
                resetKey: s.resetKey + 1,
                hudTarget: { x: HOME_TARGET.x, y: HOME_TARGET.y, z: HOME_TARGET.z },
            }));
            pushToast('SYSTEM RESET', 'warn');
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

            // 2. Telemetry + throttled HUD snapshots + mission tracking (~12Hz)
            sim.frameCount++;
            if (sim.frameCount % HUD_SAMPLE_EVERY_N_FRAMES === 0) {
                const state = get();
                const velocity = Math.abs((a.shoulder - sim.prevShoulder) / delta);
                // Simulated motor load: gravity moment on the shoulder + payload
                const torque = Math.abs(Math.cos(a.shoulder) + (state.attachedBlockId ? 1.5 : 0));

                let minDist = Infinity;
                sim.blockPositions.forEach((pos) => {
                    const dist = sim.ikTarget.distanceTo(pos);
                    if (dist < minDist) minDist = dist;
                });

                const carriedPos =
                    state.attachedBlockId !== null ? sim.blockPositions.get(state.attachedBlockId) : undefined;

                // Mission: which blocks rest in their assigned zones?
                const sorted = BLOCKS.filter(isBlockSorted).map((b) => b.id);
                const sortedChanged =
                    sorted.length !== state.sortedBlockIds.length ||
                    sorted.some((id, i) => id !== state.sortedBlockIds[i]);
                const justCompleted = !state.missionComplete && sorted.length === BLOCKS.length;
                const elapsed = (Date.now() - sim.missionStartAt) / 1000;
                let newBest: number | null = null;
                if (justCompleted && (state.missionBestTime === null || elapsed < state.missionBestTime)) {
                    newBest = elapsed;
                    try {
                        localStorage.setItem(BEST_TIME_STORAGE_KEY, String(elapsed));
                    } catch {
                        /* not persisted, still counts this session */
                    }
                }

                set((s) => {
                    const next: Partial<RobotStore> = {
                        hudAngles: { base: a.base, shoulder: a.shoulder, elbow: a.elbow },
                        hudTarget: { x: sim.ikTarget.x, y: sim.ikTarget.y, z: sim.ikTarget.z },
                        minBlockDist: Number.isFinite(minDist) ? minDist : 0,
                        hoverZoneId: carriedPos ? zoneIdAt(carriedPos) : null,
                    };
                    if (sortedChanged) next.sortedBlockIds = sorted;
                    if (!s.missionComplete) next.missionTime = elapsed;
                    if (justCompleted) {
                        next.missionComplete = true;
                        if (newBest !== null) next.missionBestTime = newBest;
                    }
                    // HUD readouts always refresh; the graph freezes while held
                    if (!s.telemetryPaused) {
                        const telemetry = [...s.telemetry, { time: sim.frameCount, velocity, torque }];
                        if (telemetry.length > TELEMETRY_WINDOW) telemetry.shift();
                        next.telemetry = telemetry;
                    }
                    return next;
                });
                if (justCompleted) {
                    pushToast(
                        `MISSION COMPLETE — ${elapsed.toFixed(1)}s${newBest !== null ? ' ★ NEW BEST' : ''}`,
                        'success'
                    );
                }
            }
            sim.prevShoulder = a.shoulder;

            // 3. Autonomous sort FSM: cycles IDLE→…→LOWER_TO_DROP→IDLE per block,
            // taking each unsorted block to ITS assigned zone, then retracts.
            if (get().mode === 'AUTO_PICK') {
                const { autoPhase } = get();
                const step = AUTO_SPEED * delta;
                const dest = new THREE.Vector3();
                let nextPhase: AutoPhase = autoPhase;

                const targetCfg = BLOCKS.find((b) => b.id === sim.autoTargetBlockId) ?? BLOCKS[0];
                const blockPos =
                    sim.blockPositions.get(sim.autoTargetBlockId) ??
                    new THREE.Vector3(targetCfg.initialPos[0], targetCfg.initialPos[1], targetCfg.initialPos[2]);
                const targetZone = ZONES.find((z) => z.id === targetCfg.zoneId) ?? ZONES[0];

                // Clamp destinations into the workspace so arrival checks can
                // always succeed — an unreachable waypoint (e.g. a block dropped
                // near the boundary) would otherwise stall the FSM forever.
                const setDest = (x: number, y: number, z: number) => {
                    dest.set(x, y, z);
                    clampTargetInPlace(dest);
                };

                switch (autoPhase) {
                    case 'IDLE': {
                        // Select the next block to sort, or retract when done
                        const nextBlock = nextUnsortedBlock();
                        if (nextBlock) {
                            sim.autoTargetBlockId = nextBlock.id;
                            nextPhase = 'APPROACH';
                        } else {
                            nextPhase = 'RETRACT';
                        }
                        break;
                    }
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
                        setDest(targetZone.center[0], 3, targetZone.center[1]);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) nextPhase = 'LOWER_TO_DROP';
                        break;
                    case 'LOWER_TO_DROP':
                        setDest(targetZone.center[0], 0.8, targetZone.center[1]);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) {
                            releaseAttached();
                            nextPhase = 'IDLE'; // pick the next unsorted block
                        }
                        break;
                    case 'RETRACT':
                        setDest(0, 3, 0);
                        if (sim.ikTarget.distanceTo(dest) < ARRIVE_THRESHOLD) {
                            set({ mode: 'MANUAL', autoPhase: 'IDLE' });
                            pushToast('AUTO SEQUENCE COMPLETE', 'success');
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
                        else releaseAttached();
                    }
                    set({ replayIndex: (replayIndex + 1) % waypoints.length });
                }
            }
        },
    };
});
