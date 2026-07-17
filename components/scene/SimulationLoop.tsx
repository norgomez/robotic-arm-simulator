'use client';

import { useFrame } from '@react-three/fiber';
import { useRobotStore } from '@/store/robotStore';

/**
 * Runs the store's per-frame simulation tick inside the R3F render loop.
 * Renders nothing — it exists so the store doesn't need its own RAF loop.
 */
export function SimulationLoop() {
    const tick = useRobotStore((s) => s.tick);
    useFrame((_, delta) => tick(delta));
    return null;
}
