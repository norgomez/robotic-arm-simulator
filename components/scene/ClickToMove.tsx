'use client';

import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useRobotStore } from '@/store/robotStore';

/**
 * Invisible ground plane that turns clicks into IK target moves (keeping the
 * target's current height). Only active in MANUAL + IK control; drags that
 * were actually camera orbits (large pointer delta) are ignored.
 */
export function ClickToMove() {
    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 4) return; // camera orbit, not a click
        const s = useRobotStore.getState();
        if (s.mode !== 'MANUAL' || s.controlMode !== 'IK') return;
        s.moveTarget(new THREE.Vector3(e.point.x, s.sim.ikTarget.y, e.point.z));
    };

    return (
        <mesh rotation={[-Math.PI / 2, 0, 0]} visible={false} onClick={handleClick}>
            <planeGeometry args={[60, 60]} />
            <meshBasicMaterial />
        </mesh>
    );
}
