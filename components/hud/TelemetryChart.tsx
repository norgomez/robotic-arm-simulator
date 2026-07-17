'use client';

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useRobotStore } from '@/store/robotStore';

/** Live shoulder velocity + simulated motor load graph. */
export function TelemetryChart() {
    const telemetry = useRobotStore((s) => s.telemetry);

    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={telemetry}>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 'auto']} />
                <Line type="monotone" dataKey="velocity" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="torque" stroke="#4ade80" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
    );
}
