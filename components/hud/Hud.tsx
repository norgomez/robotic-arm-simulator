'use client';

import { useRobotStore, GRAB_RANGE, type JointAngles } from '@/store/robotStore';
import { CommandDeck } from './CommandDeck';

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
 */
export function Hud() {
    return (
        <div className="pointer-events-none absolute inset-0 z-10">
            {/* LEFT HUD */}
            <div className="absolute top-10 left-6 w-48 flex flex-col gap-2 pointer-events-auto">
                <DiagnosticsPanel />
                <ControlModePanel />
                <ControlsHint />
            </div>

            {/* RIGHT HUD */}
            <div className="absolute top-10 right-6 w-52 flex flex-col gap-2 pointer-events-auto">
                <CoordinatesPanel />
                <ProximityPanel />
            </div>

            {/* BOTTOM COMMAND DECK */}
            <CommandDeck />
        </div>
    );
}
