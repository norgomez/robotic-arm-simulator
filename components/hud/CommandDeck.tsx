'use client';

import { useState } from 'react';
import { useRobotStore } from '@/store/robotStore';
import { TelemetryPanel } from './TelemetryChart';
import { TeachPendant } from './TeachPendant';
import { AutoPhaseStepper } from './AutoPhaseStepper';

/** Mode indicator, FSM stepper, AUTO PICK / gripper / reset controls. */
function OperationsPanel() {
    const mode = useRobotStore((s) => s.mode);
    const isGripping = useRobotStore((s) => s.isGripping);
    const startAutoPick = useRobotStore((s) => s.startAutoPick);
    const toggleGripper = useRobotStore((s) => s.toggleGripper);
    const reset = useRobotStore((s) => s.reset);

    return (
        <div className="w-1/3 h-full p-3 flex flex-col justify-center items-center gap-2 border-r border-slate-700/50">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${mode !== 'MANUAL' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                <span className="text-xs font-mono text-slate-300 tracking-wider">
                    MODE: <span className="text-white font-bold">{mode}</span>
                </span>
            </div>

            <AutoPhaseStepper />

            <div className="flex w-full max-w-xs gap-2">
                <button
                    onClick={startAutoPick}
                    disabled={mode !== 'MANUAL'}
                    className="flex-1 py-2 text-[10px] font-bold font-mono rounded transition-all border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 disabled:opacity-40"
                >
                    AUTO PICK
                </button>
                <button
                    onClick={toggleGripper}
                    className={`flex-1 py-2 text-[10px] font-bold font-mono rounded transition-all border ${
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

function CollapsedStatus() {
    const mode = useRobotStore((s) => s.mode);
    const count = useRobotStore((s) => s.waypoints.length);
    return (
        <span className="text-[9px] font-mono text-slate-400">
            MODE: <span className="text-white font-bold">{mode}</span> · PTS: {count}
        </span>
    );
}

/** The bottom bar: telemetry, operations + FSM stepper, teach pendant. Collapsible. */
export function CommandDeck() {
    const [collapsed, setCollapsed] = useState(false);

    if (collapsed) {
        return (
            <div className="absolute bottom-0 left-0 w-full h-7 bg-slate-900/95 border-t border-slate-700 backdrop-blur-xl flex items-center gap-4 px-4 pointer-events-auto">
                <button
                    onClick={() => setCollapsed(false)}
                    className="text-[9px] font-bold font-mono text-cyan-400 hover:text-cyan-300"
                >
                    ▲ COMMAND DECK
                </button>
                <CollapsedStatus />
            </div>
        );
    }

    return (
        <div className="absolute bottom-0 left-0 w-full h-40 bg-slate-900/95 border-t border-slate-700 backdrop-blur-xl flex pointer-events-auto">
            <button
                onClick={() => setCollapsed(true)}
                className="absolute -top-5 right-2 text-[9px] font-bold font-mono text-slate-500 hover:text-slate-300 bg-slate-900/80 px-1.5 rounded-t border border-b-0 border-slate-700"
            >
                ▼ HIDE
            </button>
            <TelemetryPanel />
            <OperationsPanel />
            <TeachPendant />
        </div>
    );
}
