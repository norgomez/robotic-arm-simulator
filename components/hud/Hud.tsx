'use client';

import { useEffect } from 'react';
import {
    useRobotStore,
    GRAB_RANGE,
    CAMERA_PRESETS,
    BLOCKS,
    DEFAULT_PID_GAINS,
    type JointAngles,
    type CameraPresetName,
    type PidGains,
} from '@/store/robotStore';
import { CommandDeck } from './CommandDeck';
import { Toasts } from './Toasts';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

// FK slider ranges (degrees) — enough to cover every pose the IK solver produces
const JOINT_LIMITS: Record<keyof JointAngles, [number, number]> = {
    base: [-180, 180],
    shoulder: [-90, 135],
    elbow: [0, 180],
};

function DataRow({ label, value, unit }: { label: string; value: string; unit: string }) {
    return (
        <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">{label}</span>
            <span className="text-white">
                {value}
                <span className="text-slate-600 text-[9px] ml-1">{unit}</span>
            </span>
        </div>
    );
}

function DiagnosticsPanel() {
    const angles = useRobotStore((s) => s.hudAngles);
    return (
        <div className="bg-slate-900/80 backdrop-blur border-l-2 border-cyan-500 p-3 shadow-lg">
            <h3 className="text-[10px] text-cyan-400 font-mono mb-2 tracking-widest">DIAGNOSTICS</h3>
            <div className="space-y-2">
                <DataRow label="BASE" value={(angles.base * RAD2DEG).toFixed(0)} unit="°" />
                <DataRow label="SHLDR" value={(angles.shoulder * RAD2DEG).toFixed(0)} unit="°" />
                <DataRow label="ELBOW" value={(angles.elbow * RAD2DEG).toFixed(0)} unit="°" />
            </div>
        </div>
    );
}

function CoordinatesPanel() {
    const target = useRobotStore((s) => s.hudTarget);
    const clamped = useRobotStore((s) => s.targetClamped);
    return (
        <div
            className={`bg-slate-900/80 backdrop-blur border-r-2 p-3 shadow-lg text-right transition-colors ${
                clamped ? 'border-red-500' : 'border-amber-500'
            }`}
        >
            <h3 className="text-[10px] text-amber-500 font-mono mb-2 tracking-widest">COORDINATES</h3>
            <div className="space-y-1 flex flex-col items-end">
                <DataRow label="X" value={target.x.toFixed(2)} unit="m" />
                <DataRow label="Y" value={target.y.toFixed(2)} unit="m" />
                <DataRow label="Z" value={target.z.toFixed(2)} unit="m" />
            </div>
            {clamped && (
                <div className="mt-2 text-[9px] font-bold font-mono text-red-400 animate-pulse">
                    ⚠ REACH LIMIT
                </div>
            )}
        </div>
    );
}

function ControlModePanel() {
    const mode = useRobotStore((s) => s.mode);
    const controlMode = useRobotStore((s) => s.controlMode);
    const setControlMode = useRobotStore((s) => s.setControlMode);
    const disabled = mode !== 'MANUAL';

    const btn = (active: boolean) =>
        `flex-1 py-1.5 text-[9px] font-bold font-mono rounded transition-all border ${
            active
                ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300'
                : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
        } disabled:opacity-40`;

    return (
        <div className="bg-slate-900/80 backdrop-blur border-l-2 border-purple-500 p-3 shadow-lg">
            <h3 className="text-[10px] text-purple-400 font-mono mb-2 tracking-widest">CONTROL MODE</h3>
            <div className="flex gap-1">
                <button disabled={disabled} onClick={() => setControlMode('IK')} className={btn(controlMode === 'IK')}>
                    IK TARGET
                </button>
                <button disabled={disabled} onClick={() => setControlMode('FK')} className={btn(controlMode === 'FK')}>
                    JOINT FK
                </button>
            </div>
            {controlMode === 'FK' && <FkSliders disabled={disabled} />}
        </div>
    );
}

function FkSliders({ disabled }: { disabled: boolean }) {
    const fkAngles = useRobotStore((s) => s.fkAngles);
    const setJointAngle = useRobotStore((s) => s.setJointAngle);

    const joints: { key: keyof JointAngles; label: string }[] = [
        { key: 'base', label: 'BASE' },
        { key: 'shoulder', label: 'SHLDR' },
        { key: 'elbow', label: 'ELBOW' },
    ];

    return (
        <div className="mt-3 space-y-2">
            {joints.map(({ key, label }) => {
                const deg = Math.round(fkAngles[key] * RAD2DEG);
                const [min, max] = JOINT_LIMITS[key];
                return (
                    <div key={key}>
                        <div className="flex justify-between text-[9px] font-mono mb-0.5">
                            <span className="text-slate-400">{label}</span>
                            <span className="text-white">{deg}°</span>
                        </div>
                        <input
                            type="range"
                            aria-label={`${label} joint angle`}
                            min={min}
                            max={max}
                            step={1}
                            value={deg}
                            disabled={disabled}
                            onChange={(e) => setJointAngle(key, Number(e.target.value) * DEG2RAD)}
                            className="w-full h-1 accent-cyan-400 cursor-pointer"
                        />
                    </div>
                );
            })}
        </div>
    );
}

// Slider ranges chosen so both good tunes and instructive bad ones are reachable
const PID_RANGES: Record<keyof PidGains, [number, number]> = {
    kp: [5, 200],
    ki: [0, 100],
    kd: [0, 40],
};
const PID_LABELS: Record<keyof PidGains, string> = { kp: 'KP', ki: 'KI', kd: 'KD' };

function PidPanel() {
    const gains = useRobotStore((s) => s.pidGains);
    const setPidGain = useRobotStore((s) => s.setPidGain);
    const resetPidGains = useRobotStore((s) => s.resetPidGains);

    return (
        <div className="bg-slate-900/80 backdrop-blur border-l-2 border-amber-500 p-3 shadow-lg">
            <div className="flex justify-between items-center mb-2">
                <h3 className="text-[10px] text-amber-400 font-mono tracking-widest">PID TUNING</h3>
                <button
                    onClick={resetPidGains}
                    className="px-1.5 py-0.5 text-[8px] font-bold font-mono rounded border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all"
                >
                    DEFAULTS
                </button>
            </div>
            <div className="space-y-2">
                {(Object.keys(PID_RANGES) as (keyof PidGains)[]).map((gain) => {
                    const [min, max] = PID_RANGES[gain];
                    return (
                        <div key={gain}>
                            <div className="flex justify-between text-[9px] font-mono mb-0.5">
                                <span className="text-slate-400">{PID_LABELS[gain]}</span>
                                <span className="text-white">{gains[gain]}</span>
                            </div>
                            <input
                                type="range"
                                aria-label={`${PID_LABELS[gain]} gain`}
                                min={min}
                                max={max}
                                step={1}
                                value={gains[gain]}
                                onChange={(e) => setPidGain(gain, Number(e.target.value))}
                                className="w-full h-1 accent-amber-400 cursor-pointer"
                            />
                        </div>
                    );
                })}
            </div>
            <p className="mt-2 text-[8px] font-mono text-slate-500 leading-snug">
                joint servos · watch CMD vs ACT · defaults {DEFAULT_PID_GAINS.kp}/{DEFAULT_PID_GAINS.ki}/{DEFAULT_PID_GAINS.kd}
            </p>
        </div>
    );
}

function MissionPanel() {
    const sorted = useRobotStore((s) => s.sortedBlockIds);
    const complete = useRobotStore((s) => s.missionComplete);
    const time = useRobotStore((s) => s.missionTime);
    const best = useRobotStore((s) => s.missionBestTime);
    const hydrateBestTime = useRobotStore((s) => s.hydrateBestTime);

    // localStorage is client-only; load after mount to avoid hydration mismatch
    useEffect(() => hydrateBestTime(), [hydrateBestTime]);

    return (
        <div className={`bg-slate-900/80 backdrop-blur border-r-2 p-3 shadow-lg ${complete ? 'border-green-500' : 'border-emerald-600'}`}>
            <h3 className="text-[10px] text-emerald-400 font-mono mb-2 tracking-widest text-right">
                MISSION: SORT BLOCKS
            </h3>
            <div className="space-y-1 mb-2">
                {BLOCKS.map((b) => {
                    const done = sorted.includes(b.id);
                    return (
                        <div key={b.id} className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="w-2 h-2 rounded-sm" style={{ background: b.color }} />
                            <span className="text-slate-300 flex-1">
                                BLK {b.id} → {b.zoneId}
                            </span>
                            <span className={done ? 'text-green-400 font-bold' : 'text-slate-600'}>
                                {done ? '✓' : '○'}
                            </span>
                        </div>
                    );
                })}
            </div>
            <div className="flex justify-between items-center text-[10px] font-mono border-t border-slate-700 pt-1.5">
                <span className={complete ? 'text-green-400 font-bold' : 'text-slate-300'}>
                    TIME {time.toFixed(1)}s{complete && ' ✓'}
                </span>
                <span className="text-amber-400">BEST {best !== null ? `${best.toFixed(1)}s` : '—'}</span>
            </div>
        </div>
    );
}

function CameraPanel() {
    const setCameraPreset = useRobotStore((s) => s.setCameraPreset);
    return (
        <div className="bg-slate-900/80 backdrop-blur border-r-2 border-slate-500 p-3 shadow-lg">
            <h3 className="text-[10px] text-slate-400 font-mono mb-2 tracking-widest text-right">CAMERA</h3>
            <div className="flex gap-1">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetName[]).map((name) => (
                    <button
                        key={name}
                        onClick={() => setCameraPreset(name)}
                        className="flex-1 py-1 text-[8px] font-bold font-mono rounded border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all"
                    >
                        {name}
                    </button>
                ))}
            </div>
        </div>
    );
}

function ControlsHint() {
    return (
        <div className="bg-slate-900/60 backdrop-blur border-l-2 border-slate-600 p-2 shadow-lg text-[8px] font-mono text-slate-400 leading-relaxed">
            <span className="text-slate-300">W A S D</span> move · <span className="text-slate-300">Q E</span> height
            <br />
            <span className="text-slate-300">G</span> grip · <span className="text-slate-300">R</span> record ·{' '}
            <span className="text-slate-300">SPACE</span> play
            <br />
            click floor / block to send target
        </div>
    );
}

function ProximityPanel() {
    const minDist = useRobotStore((s) => s.minBlockDist);
    const inRange = minDist < GRAB_RANGE;
    return (
        <div className="bg-slate-900/80 backdrop-blur border-r-2 border-slate-500 p-3 shadow-lg text-right">
            <h3 className="text-[10px] text-slate-400 font-mono tracking-widest mb-1">PROXIMITY (CLOSEST)</h3>
            <div className="flex justify-end items-end gap-2">
                <span className={`text-2xl font-mono font-bold ${inRange ? 'text-green-400' : 'text-slate-500'}`}>
                    {minDist.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 mb-1">m</span>
            </div>
            <div className="w-full h-1 bg-slate-700 mt-2 rounded overflow-hidden">
                <div
                    className={`h-full transition-all duration-300 ${inRange ? 'bg-green-500' : 'bg-slate-500'}`}
                    style={{ width: `${Math.max(0, Math.min(100, (3 - minDist) * 33))}%` }}
                />
            </div>
        </div>
    );
}

/**
 * The 2D overlay. A plain DOM sibling of the Canvas (not drei <Html>), so HUD
 * re-renders never touch the 3D scene. Panels subscribe to the store with
 * narrow selectors and update at the throttled HUD sample rate.
 *
 * The root is `fixed` and panels hug the window edges with minimal insets.
 * Pinch / ctrl+wheel browser page-zoom is suppressed so zooming only dollies
 * the 3D camera (OrbitControls) — otherwise the whole HUD scales and drifts
 * inward. Keyboard zoom (Ctrl +/-) still works for accessibility.
 */
export function Hud() {
    useEffect(() => {
        const onWheel = (e: WheelEvent) => {
            if (e.ctrlKey) e.preventDefault(); // trackpad pinch arrives as ctrl+wheel
        };
        const onGesture = (e: Event) => e.preventDefault(); // Safari pinch
        window.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('gesturestart', onGesture);
        window.addEventListener('gesturechange', onGesture);
        return () => {
            window.removeEventListener('wheel', onWheel);
            window.removeEventListener('gesturestart', onGesture);
            window.removeEventListener('gesturechange', onGesture);
        };
    }, []);

    return (
        <div className="pointer-events-none fixed inset-0 z-10">
            {/* LEFT HUD */}
            <div className="absolute top-2 left-2 w-48 hidden sm:flex flex-col gap-2 pointer-events-auto">
                <DiagnosticsPanel />
                <ControlModePanel />
                <PidPanel />
                <ControlsHint />
            </div>

            {/* RIGHT HUD */}
            <div className="absolute top-2 right-2 w-52 hidden sm:flex flex-col gap-2 pointer-events-auto">
                <MissionPanel />
                <CoordinatesPanel />
                <ProximityPanel />
                <CameraPanel />
            </div>

            {/* EVENT TOASTS */}
            <Toasts />

            {/* BOTTOM COMMAND DECK */}
            <CommandDeck />
        </div>
    );
}
