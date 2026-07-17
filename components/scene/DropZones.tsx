'use client';

import { Html } from '@react-three/drei';
import * as THREE from 'three';

/** Static ring markers for the two drop zones. */
export function DropZones() {
    return (
        <>
            {/* Zone A (Cyan) */}
            <group position={[-4, 0.01, 2]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1, 1.2, 32]} />
                    <meshBasicMaterial color="#06b6d4" opacity={0.3} transparent side={THREE.DoubleSide} />
                </mesh>
                <Html position={[0, 0.5, 0]} center>
                    <div className="text-[9px] font-bold text-cyan-400 bg-black/60 px-2 rounded">ZONE A</div>
                </Html>
            </group>

            {/* Zone B (Orange) */}
            <group position={[-4, 0.01, -2]}>
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[1, 1.2, 32]} />
                    <meshBasicMaterial color="#f97316" opacity={0.3} transparent side={THREE.DoubleSide} />
                </mesh>
                <Html position={[0, 0.5, 0]} center>
                    <div className="text-[9px] font-bold text-orange-400 bg-black/60 px-2 rounded">ZONE B</div>
                </Html>
            </group>
        </>
    );
}
