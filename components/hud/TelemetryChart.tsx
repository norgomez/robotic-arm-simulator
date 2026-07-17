'use client';

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useRobotStore } from '@/store/robotStore';

/**
 * Servo telemetry cell: commanded vs actual shoulder angle (degrees) with a
 * live tracking-error readout — overshoot, ringing, sag, and settling from the
 * PID tune are all directly visible here. HOLD freezes graph sampling only;
 * the rest of the HUD keeps updating.
 */
export function TelemetryPanel() {
    const telemetry = useRobotStore((s) => s.telemetry);
    const paused = useRobotStore((s) => s.telemetryPaused);
    const togglePaused = useRobotStore((s) => s.toggleTelemetryPaused);
    const last = telemetry[telemetry.length - 1];
    const err = last ? Math.abs(last.cmd - last.act) : 0;

    return (
        <div className="w-1/3 h-full p-3 pt-1.5 border-r border-slate-700/50 hidden md:flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-mono h-6 shrink-0">
                <span className="text-cyan-500">SERVO</span>
                <span className="text-amber-400">◌ CMD</span>
                <span className="text-cyan-300">● ACT</span>
                <span className={err > 5 ? 'text-red-400' : 'text-slate-400'}>ERR {err.toFixed(1)}°</span>
                <button
                    onClick={togglePaused}
                    className={`ml-auto px-1.5 py-0.5 rounded border text-[9px] font-bold transition-all ${
                        paused
                            ? 'border-amber-500 text-amber-400 bg-amber-950/40'
                            : 'border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                    {paused ? '▶ RUN' : '⏸ HOLD'}
                </button>
            </div>
            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={telemetry} margin={{ top: 4, right: 4, bottom: 2, left: 0 }}>
                        <XAxis dataKey="time" hide />
                        <YAxis
                            width={30}
                            domain={['auto', 'auto']}
                            tick={{ fontSize: 8, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                            unit="°"
                        />
                        <Line
                            type="monotone"
                            dataKey="cmd"
                            stroke="#f59e0b"
                            strokeWidth={1.5}
                            strokeDasharray="5 3"
                            dot={false}
                            isAnimationActive={false}
                        />
                        <Line type="monotone" dataKey="act" stroke="#22d3ee" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
