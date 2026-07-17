'use client';

import { useMemo } from 'react';
import { Html, Line } from '@react-three/drei';
import { useRobotStore } from '@/store/robotStore';

/** Dashed path + numbered markers for the recorded teach-pendant waypoints. */
export function WaypointVisualizer() {
    const waypoints = useRobotStore((s) => s.waypoints);
    const points = useMemo(
        () => waypoints.map((wp) => [wp.pos.x, wp.pos.y, wp.pos.z] as [number, number, number]),
        [waypoints]
    );

    return (
        <>
            {points.length > 1 && (
                <Line points={points} color="cyan" lineWidth={1} dashed dashScale={2} opacity={0.5} transparent />
            )}
            {waypoints.map((wp, i) => (
                <mesh key={i} position={wp.pos}>
                    <sphereGeometry args={[0.15]} />
                    <meshBasicMaterial color={wp.grip ? '#4ade80' : '#06b6d4'} opacity={0.6} transparent />
                    <Html position={[0, 0.2, 0]} center>
                        <div className="text-[8px] font-mono text-white bg-black/50 px-1 rounded">{i + 1}</div>
                    </Html>
                </mesh>
            ))}
        </>
    );
}
