'use client';

import * as THREE from 'three';
import { L1, MAX_REACH } from '@/utils/kinematics';

// The dome ends where the reach sphere (centered at the shoulder pivot)
// intersects the floor: cos(theta) = -L1 / MAX_REACH.
const DOME_THETA = Math.acos(-L1 / MAX_REACH);
// Radius of that floor intersection circle.
const FLOOR_RADIUS = Math.sqrt(MAX_REACH * MAX_REACH - L1 * L1);

/**
 * Subtle visualization of the reachable workspace: a translucent dome around
 * the shoulder pivot plus a boundary ring on the floor. Static and cheap —
 * gives instant feedback on why the arm won't follow a far-away target.
 */
export function WorkspaceEnvelope() {
    return (
        <>
            <mesh position={[0, L1, 0]}>
                <sphereGeometry args={[MAX_REACH, 48, 24, 0, Math.PI * 2, 0, DOME_THETA]} />
                <meshBasicMaterial
                    color="#06b6d4"
                    transparent
                    opacity={0.04}
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[FLOOR_RADIUS - 0.05, FLOOR_RADIUS, 64]} />
                <meshBasicMaterial color="#06b6d4" transparent opacity={0.25} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
        </>
    );
}
