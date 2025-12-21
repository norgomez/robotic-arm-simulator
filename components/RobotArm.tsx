import { useRef } from 'react';
import { Group } from 'three';

// Define the shape of our robot's state
interface RobotState {
    // We use 3 main degrees of freedom for now (Base, Shoulder, Elbow)
    jointAngles: {
        base: number;     // Y-axis rotation
        shoulder: number; // X-axis rotation
        elbow: number;    // X-axis rotation
    };
    isGripping?: boolean;
}

export function RobotArm({ jointAngles, isGripping = false }: RobotState) {
    // Refs allow us to access the actual 3D objects if needed later for physics
    const baseRef = useRef<Group>(null);

    // Dimensions (Mechatronics students love defining constants)
    const baseHeight = 1;
    const upperArmLength = 3;
    const forearmLength = 2.5;

    return (
        // ROOT GROUP
        <group position={[0, 0, 0]}>

            {/* --- JOINT 1: BASE (Rotates Y) --- */}
            <group rotation={[0, jointAngles.base, 0]}>

                {/* Visual: The Base Cylinder */}
                <mesh position={[0, baseHeight / 2, 0]}>
                    <cylinderGeometry args={[1, 1, baseHeight, 32]} />
                    <meshStandardMaterial color="#4b5563" /> {/* Dark Gray */}
                </mesh>

                {/* --- JOINT 2: SHOULDER (Rotates X) --- */}
                {/* We move this group up to the top of the base */}
                <group position={[0, baseHeight, 0]} rotation={[jointAngles.shoulder, 0, 0]}>

                    {/* Visual: The Joint Sphere */}
                    <mesh>
                        <sphereGeometry args={[0.7]} />
                        <meshStandardMaterial color="#d1d5db" /> {/* Light Gray */}
                    </mesh>

                    {/* Visual: Upper Arm */}
                    {/* Note: We pivot from the bottom, so we shift the mesh UP by half its length */}
                    <mesh position={[0, upperArmLength / 2, 0]}>
                        <boxGeometry args={[0.6, upperArmLength, 0.6]} />
                        <meshStandardMaterial color="#9ca3af" /> {/* Gray */}
                    </mesh>

                    {/* --- JOINT 3: ELBOW (Rotates X) --- */}
                    {/* Move to the tip of the upper arm */}
                    <group position={[0, upperArmLength, 0]} rotation={[jointAngles.elbow, 0, 0]}>

                        {/* Visual: Elbow Joint */}
                        <mesh>
                            <cylinderGeometry args={[0.5, 0.5, 0.8, 16]} rotation={[0, 0, Math.PI / 2]} />
                            <meshStandardMaterial color="#d1d5db" />
                        </mesh>

                        {/* Visual: Forearm */}
                        <mesh position={[0, forearmLength / 2, 0]}>
                            <boxGeometry args={[0.4, forearmLength, 0.4]} />
                            <meshStandardMaterial color="#f3f4f6" /> {/* White/Light */}
                        </mesh>

                        {/* --- END EFFECTOR (Updated) --- */}
                        <group position={[0, forearmLength, 0]}>
                            <mesh>
                                <sphereGeometry args={[0.3]} />
                                {/* CHANGE COLOR BASED ON GRIPPER STATE */}
                                <meshStandardMaterial
                                    color={isGripping ? "#22c55e" : "#ef4444"}
                                    emissive={isGripping ? "#22c55e" : "#000000"}
                                    emissiveIntensity={0.5}
                                />
                            </mesh>
                        </group>

                    </group> {/* End Elbow Group */}
                </group> {/* End Shoulder Group */}
            </group> {/* End Base Group */}
        </group>
    );
}