'use client';

import { useRobotStore, type AutoPhase } from '@/store/robotStore';

const PHASES: { key: AutoPhase; label: string }[] = [
    { key: 'APPROACH', label: 'APPR' },
    { key: 'DESCEND', label: 'DESC' },
    { key: 'LIFT', label: 'LIFT' },
    { key: 'MOVE_TO_ZONE', label: 'MOVE' },
    { key: 'LOWER_TO_DROP', label: 'DROP' },
    { key: 'RETRACT', label: 'RETR' },
];

/**
 * Progress indicator for the AUTO_PICK FSM. Always rendered (keeps the deck
 * layout stable and documents the sequence); lights up while a run is active —
 * done phases green, current cyan-pulsing.
 */
export function AutoPhaseStepper() {
    const mode = useRobotStore((s) => s.mode);
    const autoPhase = useRobotStore((s) => s.autoPhase);
    const active = mode === 'AUTO_PICK';
    const currentIdx = PHASES.findIndex((p) => p.key === autoPhase);

    return (
        <div className="flex items-start gap-2">
            {PHASES.map((p, i) => {
                const state = !active ? 'idle' : i < currentIdx ? 'done' : i === currentIdx ? 'current' : 'pending';
                return (
                    <div key={p.key} className="flex flex-col items-center gap-0.5">
                        <div
                            className={`w-1.5 h-1.5 rounded-full ${
                                state === 'done'
                                    ? 'bg-green-500'
                                    : state === 'current'
                                      ? 'bg-cyan-400 animate-pulse'
                                      : 'bg-slate-600'
                            }`}
                        />
                        <span
                            className={`text-[7px] font-mono ${
                                state === 'current'
                                    ? 'text-cyan-300'
                                    : state === 'done'
                                      ? 'text-green-500/70'
                                      : 'text-slate-600'
                            }`}
                        >
                            {p.label}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
