'use client';

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useRobotStore } from '@/store/robotStore';

/**
 * Live telemetry cell: shoulder velocity + simulated motor load with a visible
 * value axis, latest-sample readouts, and a hold/run toggle (HUD readouts keep
 * updating while the graph is held — only sampling into the chart pauses).
 */
export function TelemetryPanel() {
    const telemetry = useRobotStore((s) => s.telemetry);
    const paused = useRobotStore((s) => s.telemetryPaused);
    const togglePaused = useRobotStore((s) => s.toggleTelemetryPaused);
    const last = telemetry[telemetry.length - 1];

    return (
        <div className="w-1/3 h-full p-3 pt-1.5 border-r border-slate-700/50 flex flex-col">
            <div className="flex items-center gap-3 text-[10px] font-mono h-6 shrink-0">
                <span className="text-cyan-500">LIVE DATA</span>
                <span className="text-purple-400">● VEL {last ? last.velocity.toFixed(2) : '—'}</span>
                <span className="text-green-400">● LOAD {last ? last.torque.toFixed(2) : '—'}</span>
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
                            width={26}
                            domain={[0, 'auto']}
                            tick={{ fontSize: 8, fill: '#64748b' }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Line type="monotone" dataKey="velocity" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="torque" stroke="#4ade80" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
