'use client';

import { useRobotStore } from '@/store/robotStore';
import { TelemetryChart } from './TelemetryChart';

/** Mode indicator, AUTO PICK / gripper / reset controls. */
function OperationsPanel() {
    const mode = useRobotStore((s) => s.mode);
    const isGripping = useRobotStore((s) => s.isGripping);
    const startAutoPick = useRobotStore((s) => s.startAutoPick);
    const toggleGripper = useRobotStore((s) => s.toggleGripper);
    const reset = useRobotStore((s) => s.reset);

    return (
        <div className="w-1/3 h-full p-4 flex flex-col justify-center items-center gap-3 border-r border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${mode !== 'MANUAL' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-mono text-slate-300 tracking-wider">
                    MODE: <span className="text-white font-bold">{mode}</span>
                </span>
            </div>

            <div className="flex w-full max-w-xs gap-2">
                <button
                    onClick={startAutoPick}
                    disabled={mode !== 'MANUAL'}
                    className="flex-1 py-3 text-[10px] font-bold font-mono rounded transition-all border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700"
                >
                    AUTO PICK
                </button>
                <button
                    onClick={toggleGripper}
                    className={`flex-1 py-3 text-[10px] font-bold font-mono rounded transition-all border ${
                        isGripping
                            ? 'bg-amber-900/50 border-amber-500 text-amber-400'
                            : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                    {isGripping ? 'RELEASE' : 'GRAB'}
                </button>
            </div>

            <button
                onClick={reset}
                className="w-full max-w-xs py-1 text-[9px] font-bold font-mono text-red-500 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 rounded transition-all"
            >
                ⚠ RESET SYSTEM
            </button>
        </div>
    );
}

/** Waypoint record / replay controls. */
function TeachPendant() {
    const mode = useRobotStore((s) => s.mode);
    const waypointCount = useRobotStore((s) => s.waypoints.length);
    const recordWaypoint = useRobotStore((s) => s.recordWaypoint);
    const toggleReplay = useRobotStore((s) => s.toggleReplay);

    return (
        <div className="w-1/3 h-full p-6 flex flex-col justify-center gap-2">
            <div className="flex justify-between text-[10px] text-cyan-400 font-mono mb-1 border-b border-slate-700 pb-1">
                <span>TEACH PENDANT</span>
                <span>POINTS: {waypointCount}</span>
            </div>
            <div className="flex gap-2 h-12">
                <button
                    onClick={recordWaypoint}
                    disabled={mode !== 'MANUAL'}
                    className="flex-1 bg-slate-800 hover:bg-red-900/30 hover:border-red-500 border border-slate-600 rounded text-red-400 font-bold text-xs transition-all active:scale-95"
                >
                    ● REC
                </button>
                <button
                    onClick={toggleReplay}
                    disabled={waypointCount === 0}
                    className="flex-1 border bg-slate-800 border-slate-600 text-cyan-400 hover:bg-slate-700 rounded text-xs font-bold transition-all active:scale-95"
                >
                    {mode === 'REPLAY' ? '■ STOP' : '▶ PLAY'}
                </button>
            </div>
        </div>
    );
}

/** The bottom bar: telemetry graph, main operations, teach pendant. */
export function CommandDeck() {
    return (
        <div className="absolute bottom-0 left-0 w-full h-40 bg-slate-900/95 border-t border-slate-700 backdrop-blur-xl flex pointer-events-auto">
            {/* 1. TELEMETRY GRAPH */}
            <div className="w-1/3 h-full p-4 border-r border-slate-700/50 relative">
                <div className="absolute top-2 left-4 text-[10px] text-cyan-500 font-mono flex gap-4">
                    <span>LIVE DATA</span>
                    <span className="text-purple-400">● VEL</span>
                    <span className="text-green-400">● LOAD</span>
                </div>
                <div className="w-full h-full mt-2">
                    <TelemetryChart />
                </div>
            </div>

            {/* 2. MAIN OPERATIONS */}
            <OperationsPanel />

            {/* 3. PROGRAMMER UNIT */}
            <TeachPendant />
        </div>
    );
}
