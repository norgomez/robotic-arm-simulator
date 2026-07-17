'use client';

import { useRef } from 'react';
import { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { useRobotStore } from '@/store/robotStore';
import { L1, L2, L3 } from '@/utils/kinematics';

// Robot dimensions come from the kinematics module — single source of truth
const BASE_HEIGHT = L1;
const UPPER_ARM_LENGTH = L2;
const FOREARM_LENGTH = L3;

/**
 * The 3-DOF arm model. Joint rotations are written directly onto the group
 * refs from the store's per-frame sim state — no React re-renders per frame.
 */
export function RobotArm() {
    const baseRef = useRef<Group>(null);
    const shoulderRef = useRef<Group>(null);
    const elbowRef = useRef<Group>(null);
    const isGripping = useRobotStore((s) => s.isGripping);

    useFrame(() => {
        const { smoothAngles } = useRobotStore.getState().sim;
        if (baseRef.current) baseRef.current.rotation.y = smoothAngles.base;
        if (shoulderRef.current) shoulderRef.current.rotation.x = smoothAngles.shoulder;
        if (elbowRef.current) elbowRef.current.rotation.x = smoothAngles.elbow;
    });

    return (
        <group position={[0, 0, 0]}>
            {/* --- JOINT 1: BASE (rotates Y) --- */}
            <group ref={baseRef}>
                {/* Visual: The Base Cylinder */}
                <mesh position={[0, BASE_HEIGHT / 2, 0]}>
                    <cylinderGeometry args={[1, 1, BASE_HEIGHT, 32]} />
                    <meshStandardMaterial color="#4b5563" />
                </mesh>

                {/* --- JOINT 2: SHOULDER (rotates X) --- */}
                <group ref={shoulderRef} position={[0, BASE_HEIGHT, 0]}>
                    {/* Visual: The Joint Sphere */}
                    <mesh>
                        <sphereGeometry args={[0.7]} />
                        <meshStandardMaterial color="#d1d5db" />
                    </mesh>

                    {/* Visual: Upper Arm */}
                    <mesh position={[0, UPPER_ARM_LENGTH / 2, 0]}>
                        <boxGeometry args={[0.6, UPPER_ARM_LENGTH, 0.6]} />
                        <meshStandardMaterial color="#9ca3af" />
                    </mesh>

                    {/* --- JOINT 3: ELBOW (rotates X) --- */}
                    <group ref={elbowRef} position={[0, UPPER_ARM_LENGTH, 0]}>
                        {/* Visual: Elbow Joint */}
                        <mesh rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
                            <meshStandardMaterial color="#d1d5db" />
                        </mesh>

                        {/* Visual: Forearm */}
                        <mesh position={[0, FOREARM_LENGTH / 2, 0]}>
                            <boxGeometry args={[0.4, FOREARM_LENGTH, 0.4]} />
                            <meshStandardMaterial color="#f3f4f6" />
                        </mesh>

                        {/* --- END EFFECTOR (Gripper) --- */}
                        <group position={[0, FOREARM_LENGTH, 0]}>
                            <mesh>
                                <sphereGeometry args={[0.3]} />
                                <meshStandardMaterial
                                    color={isGripping ? '#22c55e' : '#ef4444'}
                                    emissive={isGripping ? '#22c55e' : '#000000'}
                                    emissiveIntensity={0.5}
                                />
                            </mesh>
                        </group>
                    </group>
                </group>
            </group>
        </group>
    );
}
