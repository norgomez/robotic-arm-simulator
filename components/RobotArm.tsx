'use client';

import { useRef } from 'react';
import { Group, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { RoundedBox, Trail } from '@react-three/drei';
import { useRobotStore } from '@/store/robotStore';
import { L1, L2, L3 } from '@/utils/kinematics';

// Robot dimensions come from the kinematics module — single source of truth
const BASE_HEIGHT = L1;
const UPPER_ARM_LENGTH = L2;
const FOREARM_LENGTH = L3;

// Gripper finger x-offsets (animated between these each frame)
const FINGER_OPEN = 0.22;
const FINGER_CLOSED = 0.1;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * The 3-DOF arm model. Joint rotations are written directly onto the group
 * refs from the store's per-frame sim state — no React re-renders per frame.
 * Finger open/close is animated the same way. PBR metal materials pick up the
 * procedural Environment lightformers set up in page.tsx.
 */
export function RobotArm() {
    const baseRef = useRef<Group>(null);
    const shoulderRef = useRef<Group>(null);
    const elbowRef = useRef<Group>(null);
    const fingerLRef = useRef<Mesh>(null);
    const fingerRRef = useRef<Mesh>(null);
    const isGripping = useRobotStore((s) => s.isGripping);

    useFrame(() => {
        const { smoothAngles } = useRobotStore.getState().sim;
        if (baseRef.current) baseRef.current.rotation.y = smoothAngles.base;
        if (shoulderRef.current) shoulderRef.current.rotation.x = smoothAngles.shoulder;
        if (elbowRef.current) elbowRef.current.rotation.x = smoothAngles.elbow;

        // Animate gripper fingers toward open/closed
        const gripTarget = useRobotStore.getState().isGripping ? FINGER_CLOSED : FINGER_OPEN;
        if (fingerLRef.current) fingerLRef.current.position.x = lerp(fingerLRef.current.position.x, -gripTarget, 0.2);
        if (fingerRRef.current) fingerRRef.current.position.x = lerp(fingerRRef.current.position.x, gripTarget, 0.2);
    });

    return (
        <group position={[0, 0, 0]}>
            {/* Base plate (static) */}
            <mesh position={[0, 0.06, 0]} receiveShadow>
                <cylinderGeometry args={[1.5, 1.6, 0.12, 48]} />
                <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
            </mesh>

            {/* --- JOINT 1: BASE (rotates Y) --- */}
            <group ref={baseRef}>
                <mesh position={[0, BASE_HEIGHT / 2, 0]} castShadow>
                    <cylinderGeometry args={[0.9, 1.05, BASE_HEIGHT, 48]} />
                    <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.35} />
                </mesh>
                {/* Status glow ring on the base */}
                <mesh position={[0, 0.18, 0]}>
                    <torusGeometry args={[1.08, 0.03, 8, 48]} />
                    <meshStandardMaterial color="#06b6d4" emissive="#06b6d4" emissiveIntensity={1.2} metalness={0.2} roughness={0.4} />
                </mesh>

                {/* --- JOINT 2: SHOULDER (rotates X) --- */}
                <group ref={shoulderRef} position={[0, BASE_HEIGHT, 0]}>
                    <mesh castShadow>
                        <sphereGeometry args={[0.62, 32, 32]} />
                        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
                    </mesh>

                    {/* Upper Arm */}
                    <RoundedBox args={[0.55, UPPER_ARM_LENGTH, 0.55]} radius={0.08} smoothness={4} position={[0, UPPER_ARM_LENGTH / 2, 0]} castShadow>
                        <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.3} />
                    </RoundedBox>

                    {/* --- JOINT 3: ELBOW (rotates X) --- */}
                    <group ref={elbowRef} position={[0, UPPER_ARM_LENGTH, 0]}>
                        <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                            <cylinderGeometry args={[0.42, 0.42, 0.8, 32]} />
                            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.25} />
                        </mesh>

                        {/* Forearm */}
                        <RoundedBox args={[0.38, FOREARM_LENGTH, 0.38]} radius={0.07} smoothness={4} position={[0, FOREARM_LENGTH / 2, 0]} castShadow>
                            <meshStandardMaterial color="#e2e8f0" metalness={0.75} roughness={0.3} />
                        </RoundedBox>

                        {/* --- END EFFECTOR (Gripper) --- */}
                        <group position={[0, FOREARM_LENGTH, 0]}>
                            {/* Wrist status sphere, with a motion trail following it */}
                            <Trail width={0.4} length={5} color="#22d3ee" attenuation={(w) => w * w}>
                                <mesh castShadow>
                                    <sphereGeometry args={[0.2, 24, 24]} />
                                    <meshStandardMaterial
                                        color={isGripping ? '#22c55e' : '#ef4444'}
                                        emissive={isGripping ? '#22c55e' : '#7f1d1d'}
                                        emissiveIntensity={0.8}
                                        metalness={0.4}
                                        roughness={0.3}
                                    />
                                </mesh>
                            </Trail>

                            {/* Fingers (animated open/close) */}
                            <mesh ref={fingerLRef} position={[-FINGER_OPEN, 0.28, 0]} castShadow>
                                <boxGeometry args={[0.07, 0.34, 0.16]} />
                                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.35} />
                            </mesh>
                            <mesh ref={fingerRRef} position={[FINGER_OPEN, 0.28, 0]} castShadow>
                                <boxGeometry args={[0.07, 0.34, 0.16]} />
                                <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.35} />
                            </mesh>
                        </group>
                    </group>
                </group>
            </group>
        </group>
    );
}
