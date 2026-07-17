'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
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
import { Hud } from '@/components/hud/Hud';
import { BLOCKS } from '@/store/robotStore';

export default function RobotPage() {
    return (
        <div className="w-screen h-screen bg-black relative">
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <Grid infiniteGrid sectionColor="#1e293b" cellColor="#334155" fadeDistance={30} />

                <SimulationLoop />
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
