'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useRobotStore } from '@/store/robotStore';

const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e'];
const KEYBOARD_SPEED = 4; // units/sec
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Keyboard control for the sim:
 * - W/A/S/D nudge the IK target horizontally (camera-relative), Q/E lower/raise it
 * - G toggles the gripper, R records a waypoint (MANUAL only)
 * - Space toggles replay
 * Movement is applied per-frame so held keys glide smoothly; moveTarget clamps
 * to the workspace, so you can safely hold a key into the boundary.
 */
export function KeyboardControls() {
    const keys = useRef(new Set<string>());

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            const k = e.key.toLowerCase();
            if (MOVE_KEYS.includes(k)) {
                keys.current.add(k);
                return;
            }
            if (e.repeat) return;
            const s = useRobotStore.getState();
            if (k === 'g' && s.mode === 'MANUAL') s.toggleGripper();
            if (k === 'r' && s.mode === 'MANUAL') s.recordWaypoint();
            if (k === ' ') {
                e.preventDefault(); // don't scroll the page
                s.toggleReplay();
            }
        };
        const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
        const onBlur = () => keys.current.clear(); // don't strand held keys on tab-away

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        window.addEventListener('blur', onBlur);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
            window.removeEventListener('blur', onBlur);
        };
    }, []);

    useFrame((state, delta) => {
        if (keys.current.size === 0) return;
        const s = useRobotStore.getState();
        if (s.mode !== 'MANUAL' || s.controlMode !== 'IK') return;

        // Camera-relative planar axes so WASD matches what you see
        const fwd = new THREE.Vector3();
        state.camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const right = new THREE.Vector3().crossVectors(fwd, UP);

        const move = new THREE.Vector3();
        if (keys.current.has('w')) move.add(fwd);
        if (keys.current.has('s')) move.sub(fwd);
        if (keys.current.has('d')) move.add(right);
        if (keys.current.has('a')) move.sub(right);
        if (keys.current.has('e')) move.y += 1;
        if (keys.current.has('q')) move.y -= 1;
        if (move.lengthSq() === 0) return;

        move.normalize().multiplyScalar(KEYBOARD_SPEED * delta);
        s.moveTarget(s.sim.ikTarget.clone().add(move));
    });

    return null;
}
