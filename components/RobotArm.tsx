import { useRef } from 'react';
import { Group } from 'three';

interface RobotState {
    jointAngles: {
        base: number;
        shoulder: number;
        elbow: number;
    };
    isGripping?: boolean;
}

export function RobotArm({ jointAngles, isGripping = false }: RobotState) {
    const baseHeight = 1;
    const upperArmLength = 3;
    const forearmLength = 2.5;

    return (
        <group position={[0, 0, 0]}>

            {/* --- JOINT 1: BASE (Rotates Y) --- */}
            <group rotation={[0, jointAngles.base, 0]}>

                {/* Visual: The Base Cylinder */}
                <mesh position={[0, baseHeight / 2, 0]}>
                    <cylinderGeometry args={[1, 1, baseHeight, 32]} />
                    <meshStandardMaterial color="#4b5563" />
                </mesh>

                {/* --- JOINT 2: SHOULDER (Rotates X) --- */}
                <group position={[0, baseHeight, 0]} rotation={[jointAngles.shoulder, 0, 0]}>

                    {/* Visual: The Joint Sphere */}
                    <mesh>
                        <sphereGeometry args={[0.7]} />
                        <meshStandardMaterial color="#d1d5db" />
                    </mesh>

                    {/* Visual: Upper Arm */}
                    <mesh position={[0, upperArmLength / 2, 0]}>
                        <boxGeometry args={[0.6, upperArmLength, 0.6]} />
                        <meshStandardMaterial color="#9ca3af" />
                    </mesh>

                    {/* --- JOINT 3: ELBOW (Rotates X) --- */}
                    <group position={[0, upperArmLength, 0]} rotation={[jointAngles.elbow, 0, 0]}>

                        {/* Visual: Elbow Joint */}
                        {/* FIX: Moved rotation from cylinderGeometry to mesh */}
                        <mesh rotation={[0, 0, Math.PI / 2]}>
                            <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} />
                            <meshStandardMaterial color="#d1d5db" />
                        </mesh>

                        {/* Visual: Forearm */}
                        <mesh position={[0, forearmLength / 2, 0]}>
                            <boxGeometry args={[0.4, forearmLength, 0.4]} />
                            <meshStandardMaterial color="#f3f4f6" />
                        </mesh>

                        {/* --- END EFFECTOR (Gripper) --- */}
                        <group position={[0, forearmLength, 0]}>
                            <mesh>
                                <sphereGeometry args={[0.3]} />
                                <meshStandardMaterial
                                    color={isGripping ? "#22c55e" : "#ef4444"}
                                    emissive={isGripping ? "#22c55e" : "#000000"}
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