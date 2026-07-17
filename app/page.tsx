'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, Lightformer, ContactShadows } from '@react-three/drei';
import { RobotArm } from '@/components/RobotArm';
import { SimulationLoop } from '@/components/scene/SimulationLoop';
import { Block } from '@/components/scene/Block';
import { DropZones } from '@/components/scene/DropZones';
import { WaypointVisualizer } from '@/components/scene/WaypointVisualizer';
import { TargetControl } from '@/components/scene/TargetControl';
import { TargetMarker } from '@/components/scene/TargetMarker';
import { WorkspaceEnvelope } from '@/components/scene/WorkspaceEnvelope';
import { ClickToMove } from '@/components/scene/ClickToMove';
import { KeyboardControls } from '@/components/scene/KeyboardControls';
import { CameraRig } from '@/components/scene/CameraRig';
import { Hud } from '@/components/hud/Hud';
import { BLOCKS } from '@/store/robotStore';

export default function RobotPage() {
    return (
        <div className="w-screen h-screen bg-black relative">
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                <color attach="background" args={['#0f172a']} />
                <fog attach="fog" args={['#0f172a', 18, 45]} />

                {/* Lighting: key light + procedural environment (no network fetch) */}
                <ambientLight intensity={0.25} />
                <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />
                <Environment resolution={64} frames={1}>
                    <Lightformer intensity={2} position={[0, 8, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[12, 12, 1]} />
                    <Lightformer intensity={1.2} color="#7dd3fc" position={[-8, 3, -4]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
                    <Lightformer intensity={0.8} color="#fbbf24" position={[8, 2, 4]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 2, 1]} />
                </Environment>
                <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={22} blur={2.4} far={5} resolution={256} color="#020617" />

                <Grid infiniteGrid sectionColor="#1e293b" cellColor="#334155" fadeDistance={30} />

                <SimulationLoop />
                <CameraRig />
                <RobotArm />
                {BLOCKS.map((block) => (
                    <Block key={block.id} data={block} />
                ))}
                <DropZones />
                <WaypointVisualizer />
                <WorkspaceEnvelope />
                <TargetMarker />
                <TargetControl />
                <ClickToMove />
                <KeyboardControls />

                <OrbitControls makeDefault />
            </Canvas>
            <Hud />
        </div>
    );
}
