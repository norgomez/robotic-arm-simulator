'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRobotStore } from '@/store/robotStore';

/**
 * Smoothly flies the camera to the store's pending preset goal, then hands
 * control back to OrbitControls. Framerate-independent damping.
 */
export function CameraRig() {
    const goal = useRobotStore((s) => s.cameraGoal);
    const target = useRef<THREE.Vector3 | null>(null);

    useEffect(() => {
        if (goal) target.current = new THREE.Vector3(goal.pos[0], goal.pos[1], goal.pos[2]);
    }, [goal]);

    useFrame((state, delta) => {
        if (!target.current) return;
        const k = 1 - Math.pow(0.002, delta); // exponential smoothing
        state.camera.position.lerp(target.current, k);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (state.controls as any)?.update?.();
        if (state.camera.position.distanceTo(target.current) < 0.05) target.current = null;
    });

    return null;
}
