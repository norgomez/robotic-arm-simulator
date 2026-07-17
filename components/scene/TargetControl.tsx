'use client';

import { useState } from 'react';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore } from '@/store/robotStore';

/**
 * The draggable IK target gizmo, shown only in MANUAL mode. While MANUAL, the
 * gizmo is the source of truth for the target; every drag feeds moveTarget()
 * which re-solves IK. Remounts on mode change / reset so it picks up the
 * store's current target position.
 */
export function TargetControl() {
    const mode = useRobotStore((s) => s.mode);
    const resetKey = useRobotStore((s) => s.resetKey);
    const moveTarget = useRobotStore((s) => s.moveTarget);

    if (mode !== 'MANUAL') return null;
    return <TargetGizmo key={resetKey} onMove={moveTarget} />;
}

function TargetGizmo({ onMove }: { onMove: (pos: THREE.Vector3) => void }) {
    // Read the target once on mount (fresh on every remount)
    const [initial] = useState(() => useRobotStore.getState().sim.ikTarget.clone());

    return (
        <TransformControls
            position={initial}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onObjectChange={(e: any) => onMove(e.target.object.position)}
        >
            <mesh visible={false}>
                <sphereGeometry args={[0.1]} />
            </mesh>
        </TransformControls>
    );
}
