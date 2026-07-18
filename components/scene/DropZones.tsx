'use client';

import { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useRobotStore, ZONES, ZONE_RADIUS, type ZoneConfig } from '@/store/robotStore';

const PULSE_DURATION_MS = 800;

/** One-shot expanding ring played when a block is delivered into the zone. */
function PulseRing({ color, pulseKey }: { color: string; pulseKey: number }) {
    const meshRef = useRef<THREE.Mesh>(null);
    const startedAt = useRef(-1);

    useEffect(() => {
        if (pulseKey > 0) startedAt.current = performance.now();
    }, [pulseKey]);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const t = (performance.now() - startedAt.current) / PULSE_DURATION_MS;
        if (startedAt.current < 0 || t >= 1) {
            mesh.visible = false;
            return;
        }
        mesh.visible = true;
        mesh.scale.setScalar(1 + t * 1.4);
        (mesh.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t);
    });

    return (
        <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[ZONE_RADIUS - 0.1, ZONE_RADIUS, 48]} />
            <meshBasicMaterial color={color} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
    );
}

function Zone({ zone }: { zone: ZoneConfig }) {
    const hovered = useRobotStore((s) => s.hoverZoneId === zone.id);
    const pulseKey = useRobotStore((s) => (s.zonePulse?.zoneId === zone.id ? s.zonePulse.key : 0));

    return (
        <group position={[zone.center[0], 0.01, zone.center[1]]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[ZONE_RADIUS - 0.2, ZONE_RADIUS, 48]} />
                <meshBasicMaterial
                    color={zone.color}
                    opacity={hovered ? 0.9 : 0.3}
                    transparent
                    side={THREE.DoubleSide}
                    depthWrite={false}
                />
            </mesh>
            {/* Filled glow while a carried block hovers over the zone */}
            {hovered && (
                <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[ZONE_RADIUS - 0.2, 48]} />
                    <meshBasicMaterial color={zone.color} opacity={0.15} transparent side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
            )}
            <PulseRing color={zone.color} pulseKey={pulseKey} />
            <Html position={[0, 0.5, 0]} center>
                <div className="text-[9px] font-bold bg-black/60 px-2 rounded" style={{ color: zone.color }}>
                    ZONE {zone.id}
                </div>
            </Html>
        </group>
    );
}

/** Drop-zone markers, driven by the ZONES config in the store. */
export function DropZones() {
    return (
        <>
            {ZONES.map((zone) => (
                <Zone key={zone.id} zone={zone} />
            ))}
        </>
    );
}
