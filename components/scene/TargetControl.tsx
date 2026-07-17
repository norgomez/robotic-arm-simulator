'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { TransformControls } from '@react-three/drei';
import { useRobotStore } from '@/store/robotStore';

/**
 * The draggable IK target gizmo, shown in MANUAL + IK control mode.
 * Bidirectional sync: dragging feeds moveTarget() (which clamps + solves IK);
 * when NOT dragging, the gizmo follows sim.ikTarget each frame so click-to-move,
 * keyboard nudges, and reset all reposition it. If a drag ran past the
 * workspace boundary, releasing snaps the gizmo back to the clamped target.
 */
export function TargetControl() {
    const mode = useRobotStore((s) => s.mode);
    const controlMode = useRobotStore((s) => s.controlMode);

    if (mode !== 'MANUAL' || controlMode !== 'IK') return null;
    return <TargetGizmo />;
}

function TargetGizmo() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const controlsRef = useRef<any>(null);

    useFrame(() => {
        const controls = controlsRef.current;
        if (controls?.object && !controls.dragging) {
            controls.object.position.copy(useRobotStore.getState().sim.ikTarget);
        }
    });

    return (
        <TransformControls
            ref={controlsRef}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onObjectChange={(e: any) => useRobotStore.getState().moveTarget(e.target.object.position)}
        >
            {/* Invisible handle; raycast disabled so it never swallows scene clicks */}
            <mesh visible={false} raycast={() => null}>
                <sphereGeometry args={[0.1]} />
            </mesh>
        </TransformControls>
    );
}
