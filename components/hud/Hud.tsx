'use client';

import { useRobotStore, GRAB_RANGE } from '@/store/robotStore';
import { CommandDeck } from './CommandDeck';

const RAD2DEG = 180 / Math.PI;

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
    return (
        <div className="bg-slate-900/80 backdrop-blur border-r-2 border-amber-500 p-3 shadow-lg text-right">
            <h3 className="text-[10px] text-amber-500 font-mono mb-2 tracking-widest">COORDINATES</h3>
            <div className="space-y-1 flex flex-col items-end">
                <DataRow label="X" value={target.x.toFixed(2)} unit="m" />
                <DataRow label="Y" value={target.y.toFixed(2)} unit="m" />
                <DataRow label="Z" value={target.z.toFixed(2)} unit="m" />
            </div>
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
