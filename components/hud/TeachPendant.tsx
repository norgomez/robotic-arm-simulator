'use client';

import { useRobotStore } from '@/store/robotStore';

function MiniBtn({
    children,
    onClick,
    disabled,
    title,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="px-1.5 py-0.5 text-[8px] font-bold font-mono rounded border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-all disabled:opacity-30"
        >
            {children}
        </button>
    );
}

/**
 * Waypoint programmer: scrollable list with per-point grip toggle, reorder and
 * delete, plus save/load (localStorage) and record/replay controls. The active
 * waypoint is highlighted during replay.
 */
export function TeachPendant() {
    const mode = useRobotStore((s) => s.mode);
    const waypoints = useRobotStore((s) => s.waypoints);
    const replayIndex = useRobotStore((s) => s.replayIndex);
    const recordWaypoint = useRobotStore((s) => s.recordWaypoint);
    const toggleReplay = useRobotStore((s) => s.toggleReplay);
    const deleteWaypoint = useRobotStore((s) => s.deleteWaypoint);
    const toggleWaypointGrip = useRobotStore((s) => s.toggleWaypointGrip);
    const moveWaypoint = useRobotStore((s) => s.moveWaypoint);
    const clearWaypoints = useRobotStore((s) => s.clearWaypoints);
    const saveProgram = useRobotStore((s) => s.saveProgram);
    const loadProgram = useRobotStore((s) => s.loadProgram);

    const editable = mode === 'MANUAL';

    return (
        <div className="w-1/3 h-full p-3 flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-[10px] text-cyan-400 font-mono border-b border-slate-700 pb-1">
                <span>TEACH PENDANT</span>
                <div className="flex gap-1">
                    <MiniBtn onClick={saveProgram} disabled={!editable || waypoints.length === 0} title="Save program to browser storage">
                        SAVE
                    </MiniBtn>
                    <MiniBtn onClick={loadProgram} disabled={!editable} title="Load saved program">
                        LOAD
                    </MiniBtn>
                    <MiniBtn onClick={clearWaypoints} disabled={!editable || waypoints.length === 0} title="Clear all waypoints">
                        CLR
                    </MiniBtn>
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto space-y-0.5 pr-1">
                {waypoints.length === 0 && (
                    <div className="text-[9px] font-mono text-slate-600 pt-3 text-center">
                        NO WAYPOINTS — ● REC OR PRESS R
                    </div>
                )}
                {waypoints.map((wp, i) => {
                    const isActive = mode === 'REPLAY' && i === replayIndex;
                    return (
                        <div
                            key={i}
                            className={`flex items-center gap-1 text-[9px] font-mono rounded px-1 py-0.5 ${
                                isActive ? 'bg-cyan-900/50 text-cyan-200' : 'bg-slate-800/60 text-slate-300'
                            }`}
                        >
                            <span className="w-3 text-slate-500">{i + 1}</span>
                            <span className="flex-1 truncate">
                                ({wp.pos.x.toFixed(1)}, {wp.pos.y.toFixed(1)}, {wp.pos.z.toFixed(1)})
                            </span>
                            <button
                                disabled={!editable}
                                onClick={() => toggleWaypointGrip(i)}
                                title="Toggle grip action at this waypoint"
                                className={`px-1 font-bold ${wp.grip ? 'text-green-400' : 'text-slate-500'} disabled:opacity-40`}
                            >
                                {wp.grip ? 'GRIP' : 'OPEN'}
                            </button>
                            <button
                                disabled={!editable || i === 0}
                                onClick={() => moveWaypoint(i, -1)}
                                aria-label={`Move waypoint ${i + 1} up`}
                                className="text-slate-400 hover:text-white disabled:opacity-30"
                            >
                                ▲
                            </button>
                            <button
                                disabled={!editable || i === waypoints.length - 1}
                                onClick={() => moveWaypoint(i, 1)}
                                aria-label={`Move waypoint ${i + 1} down`}
                                className="text-slate-400 hover:text-white disabled:opacity-30"
                            >
                                ▼
                            </button>
                            <button
                                disabled={!editable}
                                onClick={() => deleteWaypoint(i)}
                                aria-label={`Delete waypoint ${i + 1}`}
                                className="text-red-400 hover:text-red-300 disabled:opacity-30"
                            >
                                ✕
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="flex gap-2 h-8 items-center">
                <span className="text-[9px] font-mono text-slate-500">PTS: {waypoints.length}</span>
                <button
                    onClick={recordWaypoint}
                    disabled={!editable}
                    className="flex-1 h-full bg-slate-800 hover:bg-red-900/30 hover:border-red-500 border border-slate-600 rounded text-red-400 font-bold text-[10px] transition-all active:scale-95 disabled:opacity-40"
                >
                    ● REC
                </button>
                <button
                    onClick={toggleReplay}
                    disabled={waypoints.length === 0}
                    className="flex-1 h-full border bg-slate-800 border-slate-600 text-cyan-400 hover:bg-slate-700 rounded text-[10px] font-bold transition-all active:scale-95 disabled:opacity-40"
                >
                    {mode === 'REPLAY' ? '■ STOP' : '▶ PLAY'}
                </button>
            </div>
        </div>
    );
}
