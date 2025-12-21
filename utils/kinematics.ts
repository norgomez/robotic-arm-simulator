// Robot Dimensions (Must match your 3D model in RobotArm.tsx)
const L1 = 1;   // Base height (from ground to shoulder pivot)
const L2 = 3;   // Upper Arm length
const L3 = 2.5; // Forearm length

export function solveIK(x: number, y: number, z: number) {
    // 1. BASE ANGLE (Rotation around Y-axis)
    // We use atan2 to find the angle based on X and Z coordinates
    let theta1 = Math.atan2(x, z);

    // 2. TARGET DISTANCE CALCULATION
    // Horizontal distance from base center to target
    const r = Math.sqrt(x * x + z * z);
    // Vertical distance from shoulder pivot (L1) to target
    const dy = y - L1;

    // Distance from shoulder pivot to target (Hypotenuse of the imaginary triangle)
    const h = Math.sqrt(r * r + dy * dy);

    // Limit: If target is out of reach, clamp it to the max reach
    if (h > L2 + L3) {
        // console.warn("Target out of reach");
        // In a real robot, we would return the previous valid angle or an error
        return null;
    }

    // 3. LAW OF COSINES (for Shoulder and Elbow)
    // We form a triangle with sides: L2 (upper arm), L3 (forearm), h (distance to target)

    // Angle inside the triangle at the shoulder
    // a = acos( (b^2 + c^2 - a^2) / 2bc )
    const phi1 = Math.acos((L2 * L2 + h * h - L3 * L3) / (2 * L2 * h));

    // Angle of the target elevation relative to the horizon
    const phi2 = Math.atan2(dy, r);

    // Theta 2: Shoulder Angle (Elevation + Interior Triangle Angle)
    // We subtract from 90 degrees (PI/2) because our robot's zero is vertical
    let theta2 = (Math.PI / 2) - (phi1 + phi2);

    // Theta 3: Elbow Angle (Interior angle of the triangle)
    const phi3 = Math.acos((L2 * L2 + L3 * L3 - h * h) / (2 * L2 * L3));
    let theta3 = Math.PI - phi3;

    // 4. RETURN ANGLES
    return {
        base: theta1,
        shoulder: theta2,
        elbow: theta3
    };
}