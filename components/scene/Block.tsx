'use client';

import { useEffect, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore, CARRY_OFFSET_Y, type BlockConfig } from '@/store/robotStore';

/** Hover height above a clicked block — keeps the target inside grab range. */
const APPROACH_OFFSET_Y = 1;

const GRAVITY = 0.02;
const FLOOR_Y = 0.5; // resting height of a 1x1x1 block

/**
 * A pickable block with simple gravity + floor collision. While attached to
 * the gripper it follows the IK target; its live position is reported to the
 * store each frame so grabbing/proximity checks can find it.
 */
export function Block({ data }: { data: BlockConfig }) {
    const meshRef = useRef<THREE.Mesh>(null);
    // Pass coordinates individually (spreading the tuple breaks TS inference)
    const position = useRef(
        new THREE.Vector3(data.initialPos[0], data.initialPos[1], data.initialPos[2])
    );
    const velocityY = useRef(0);

    const attachedBlockId = useRobotStore((s) => s.attachedBlockId);
    const resetKey = useRobotStore((s) => s.resetKey);
    const isAttached = attachedBlockId === data.id;

    // Snap back to the initial position on system reset
    useEffect(() => {
        position.current.set(data.initialPos[0], data.initialPos[1], data.initialPos[2]);
        velocityY.current = 0;
    }, [resetKey, data.initialPos]);

    useFrame(() => {
        if (!meshRef.current) return;
        const { sim, reportBlockPosition } = useRobotStore.getState();

        if (isAttached) {
            // Carried: hang below the gripper
            position.current.set(sim.ikTarget.x, sim.ikTarget.y + CARRY_OFFSET_Y, sim.ikTarget.z);
            velocityY.current = 0;
        } else {
            // Gravity
            if (position.current.y > FLOOR_Y) {
                velocityY.current -= GRAVITY;
                position.current.y += velocityY.current;
            }
            // Floor collision
            if (position.current.y <= FLOOR_Y) {
                position.current.y = FLOOR_Y;
                velocityY.current = 0;
            }
        }

        meshRef.current.position.copy(position.current);
        reportBlockPosition(data.id, position.current);
    });

    // Click a block to send the arm hovering right above it (then G / GRAB)
    const handleClick = (e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta > 4) return; // camera orbit, not a click
        const s = useRobotStore.getState();
        if (s.mode !== 'MANUAL' || s.controlMode !== 'IK' || s.attachedBlockId !== null) return;
        s.moveTarget(position.current.clone().add(new THREE.Vector3(0, APPROACH_OFFSET_Y, 0)));
    };

    return (
        <mesh ref={meshRef} castShadow receiveShadow onClick={handleClick}>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={isAttached ? '#fbbf24' : data.color} />
            <Html position={[0, 1, 0]} center distanceFactor={10}>
                <div className="text-[8px] font-bold text-white bg-black/40 px-1 rounded">
                    ID: {data.id}
                </div>
            </Html>
        </mesh>
    );
}
