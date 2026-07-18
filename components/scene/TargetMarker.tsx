'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRobotStore } from '@/store/robotStore';

/**
 * Always-visible marker at the IK target: a small glowing sphere with a pulsing
 * halo. Cyan when the target is reachable; amber while the requested position
 * is being clamped to the workspace boundary.
 */
export function TargetMarker() {
    const groupRef = useRef<THREE.Group>(null);
    const haloRef = useRef<THREE.Mesh>(null);
    const clamped = useRobotStore((s) => s.targetClamped);
    const color = clamped ? '#f59e0b' : '#22d3ee';

    useFrame(({ clock }) => {
        const g = groupRef.current;
        if (!g) return;
        g.position.copy(useRobotStore.getState().sim.ikTarget);
        if (haloRef.current) {
            const pulse = 1 + 0.2 * Math.sin(clock.elapsedTime * 4);
            haloRef.current.scale.setScalar(pulse);
        }
    });

    return (
        <group ref={groupRef}>
            <mesh>
                <sphereGeometry args={[0.12, 16, 16]} />
                <meshBasicMaterial color={color} transparent opacity={0.9} depthWrite={false} />
            </mesh>
            <mesh ref={haloRef}>
                <sphereGeometry args={[0.22, 16, 16]} />
                <meshBasicMaterial color={color} wireframe transparent opacity={0.35} depthWrite={false} />
            </mesh>
        </group>
    );
}
