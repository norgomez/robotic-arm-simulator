// Robot Dimensions — single source of truth, shared with the 3D model in
// components/RobotArm.tsx and the workspace envelope.
export const L1 = 1;   // Base height (from ground to shoulder pivot)
export const L2 = 3;   // Upper Arm length
export const L3 = 2.5; // Forearm length

/** Outer edge of the reachable workspace (from the shoulder pivot). */
export const MAX_REACH = L2 + L3;
/** Inner dead zone around the shoulder pivot (|L2-L3| singularity + margin). */
export const MIN_REACH = 0.6;

// acos hardened against floating-point drift just outside [-1, 1]
const safeAcos = (v: number) => Math.acos(Math.min(1, Math.max(-1, v)));

export function solveIK(x: number, y: number, z: number) {
    // 1. BASE ANGLE (Rotation around Y-axis)
    // We use atan2 to find the angle based on X and Z coordinates
    const theta1 = Math.atan2(x, z);

    // 2. TARGET DISTANCE CALCULATION
    // Horizontal distance from base center to target
    const r = Math.sqrt(x * x + z * z);
    // Vertical distance from shoulder pivot (L1) to target
    const dy = y - L1;

    // Distance from shoulder pivot to target (Hypotenuse of the imaginary triangle)
    const h = Math.sqrt(r * r + dy * dy);

    // Limit: If target is out of reach there is no solution
    // (callers clamp into the workspace first — see the store's moveTarget)
    if (h > L2 + L3) {
        return null;
    }

    // 3. LAW OF COSINES (for Shoulder and Elbow)
    // We form a triangle with sides: L2 (upper arm), L3 (forearm), h (distance to target)

    // Angle inside the triangle at the shoulder
    // a = acos( (b^2 + c^2 - a^2) / 2bc )
    const phi1 = safeAcos((L2 * L2 + h * h - L3 * L3) / (2 * L2 * h));

    // Angle of the target elevation relative to the horizon
    const phi2 = Math.atan2(dy, r);

    // Theta 2: Shoulder Angle (Elevation + Interior Triangle Angle)
    // We subtract from 90 degrees (PI/2) because our robot's zero is vertical
    const theta2 = (Math.PI / 2) - (phi1 + phi2);

    // Theta 3: Elbow Angle (Interior angle of the triangle)
    const phi3 = safeAcos((L2 * L2 + L3 * L3 - h * h) / (2 * L2 * L3));
    const theta3 = Math.PI - phi3;

    // 4. RETURN ANGLES
    return {
        base: theta1,
        shoulder: theta2,
        elbow: theta3
    };
}

/**
 * Forward kinematics: end-effector position for a set of joint angles.
 * Inverse of solveIK — angles use the same conventions (radians; shoulder zero
 * is vertical, positive tilts the arm forward/down; base 0 faces +Z).
 */
export function solveFK(base: number, shoulder: number, elbow: number) {
    // Planar reach and height in the arm's vertical plane
    const r = L2 * Math.sin(shoulder) + L3 * Math.sin(shoulder + elbow);
    const y = L1 + L2 * Math.cos(shoulder) + L3 * Math.cos(shoulder + elbow);
    // Base rotation maps the plane into world X/Z (matches theta1 = atan2(x, z))
    return { x: r * Math.sin(base), y, z: r * Math.cos(base) };
}
