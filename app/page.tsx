'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, TransformControls, Html } from '@react-three/drei';
import { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { RobotArm } from '../components/RobotArm';
import { solveIK } from '../utils/kinematics';

// --- MATH HELPER ---
const lerp = (start: number, end: number, speed: number) => start + (end - start) * speed;

// --- 1. The Interactive Block ---
function Block({ targetPosition, isAttached, onRest }: any) {
    const meshRef = useRef<THREE.Mesh>(null);
    const position = useRef(new THREE.Vector3(4, 0.5, 4));
    const velocityY = useRef(0);

    useFrame(() => {
        if (!meshRef.current) return;
        if (isAttached) {
            position.current.copy(targetPosition);
            velocityY.current = 0;
        } else {
            if (position.current.y > 0.5) {
                velocityY.current -= 0.02;
                position.current.y += velocityY.current;
            }
            if (position.current.y <= 0.5) {
                position.current.y = 0.5;
                velocityY.current = 0;
            }
        }
        meshRef.current.position.copy(position.current);
        if (onRest) onRest(position.current);
    });

    return (
        <mesh ref={meshRef} castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={isAttached ? "#fbbf24" : "#3b82f6"} />
        </mesh>
    );
}

// --- 2. Drop Zone Visual ---
function DropZone() {
    return (
        <group position={[-4, 0.01, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[1, 1.2, 32]} />
                <meshBasicMaterial color="#22c55e" opacity={0.5} transparent />
            </mesh>
            <Html position={[0, 1, 0]} center>
                <div className="text-xs font-bold text-green-600 bg-white/80 px-2 rounded">DROP ZONE</div>
            </Html>
        </group>
    );
}

// --- 3. Main Controller ---
function RobotController() {
    const [ikTarget, setIkTarget] = useState(new THREE.Vector3(2, 2, 2));
    const [smoothAngles, setSmoothAngles] = useState({ base: 0, shoulder: 0, elbow: 0 });
    const desiredAngles = useRef({ base: 0, shoulder: 0, elbow: 0 });

    // Previous frame angles for velocity calc
    const prevAngles = useRef({ base: 0, shoulder: 0, elbow: 0 });

    const blockPosRef = useRef(new THREE.Vector3(4, 0.5, 4));
    const [isGripping, setIsGripping] = useState(false);
    const [hasBlock, setHasBlock] = useState(false);
    const [autoPhase, setAutoPhase] = useState('IDLE');

    // TELEMETRY STATE
    const [telemetryData, setTelemetryData] = useState<any[]>([]);
    const frameCount = useRef(0);

    // --- THE LOOP (60 FPS) ---
    useFrame((state, delta) => {
        // 1. PHYSICS INTERPOLATION
        const newAngles = {
            base: lerp(smoothAngles.base, desiredAngles.current.base, 0.1),
            shoulder: lerp(smoothAngles.shoulder, desiredAngles.current.shoulder, 0.1),
            elbow: lerp(smoothAngles.elbow, desiredAngles.current.elbow, 0.1)
        };
        setSmoothAngles(newAngles);

        // 2. TELEMETRY CALCULATION (Throttle to every 5th frame to save performance)
        frameCount.current++;
        if (frameCount.current % 5 === 0) {
            // Velocity = Change / Time
            const shoulderVel = Math.abs((newAngles.shoulder - prevAngles.current.shoulder) / delta);

            // Torque Approximation (Gravity + Payload)
            // Holding arm out (Angle 0) = Max Torque. Holding payload = More Torque.
            const armLoad = Math.cos(newAngles.shoulder); // Simple gravity model
            const payloadLoad = hasBlock ? 1.5 : 0;
            const totalTorque = Math.abs(armLoad + payloadLoad);

            setTelemetryData(prev => {
                const newData = [...prev, { time: frameCount.current, velocity: shoulderVel, torque: totalTorque }];
                if (newData.length > 50) newData.shift(); // Keep last 50 points
                return newData;
            });
        }
        prevAngles.current = newAngles;

        // 3. AUTO SEQUENCE LOGIC
        if (autoPhase !== 'IDLE') {
            const speed = 6 * delta;
            let targetDest = new THREE.Vector3();
            let nextPhase = autoPhase;
            let threshold = 0.1;

            switch (autoPhase) {
                case 'APPROACH':
                    targetDest.set(blockPosRef.current.x, blockPosRef.current.y + 2, blockPosRef.current.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'DESCEND';
                    break;
                case 'DESCEND':
                    targetDest.set(blockPosRef.current.x, blockPosRef.current.y, blockPosRef.current.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) {
                        setIsGripping(true); setHasBlock(true); nextPhase = 'LIFT';
                    }
                    break;
                case 'LIFT':
                    targetDest.set(blockPosRef.current.x, 3, blockPosRef.current.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'MOVE_TO_ZONE';
                    break;
                case 'MOVE_TO_ZONE':
                    targetDest.set(-4, 3, 0);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'LOWER_TO_DROP';
                    break;
                case 'LOWER_TO_DROP':
                    targetDest.set(-4, 0.8, 0);
                    if (ikTarget.distanceTo(targetDest) < threshold) {
                        setIsGripping(false); setHasBlock(false); nextPhase = 'RETRACT';
                    }
                    break;
                case 'RETRACT':
                    targetDest.set(0, 3, 0);
                    if (ikTarget.distanceTo(targetDest) < threshold) setAutoPhase('IDLE');
                    break;
            }

            if (autoPhase !== 'IDLE') {
                const direction = new THREE.Vector3().subVectors(targetDest, ikTarget).normalize();
                const moveStep = direction.multiplyScalar(speed);
                handleTargetMove(ikTarget.clone().add(moveStep));
                if (nextPhase !== autoPhase) setAutoPhase(nextPhase);
            }
        }
    });

    const handleTargetMove = (newPos: THREE.Vector3) => {
        setIkTarget(newPos);
        const solution = solveIK(newPos.x, newPos.y, newPos.z);
        if (solution) desiredAngles.current = solution;
    };

    const startAutoSequence = () => {
        if (hasBlock) { alert("Please drop the block first!"); return; }
        setAutoPhase('APPROACH');
    };

    return (
        <>
            <RobotArm jointAngles={smoothAngles} isGripping={isGripping} />
            <Block targetPosition={new THREE.Vector3(ikTarget.x, ikTarget.y - 0.75, ikTarget.z)} isAttached={hasBlock} onRest={(pos: THREE.Vector3) => blockPosRef.current.copy(pos)} />
            <DropZone />
            {autoPhase === 'IDLE' && <TargetControl position={ikTarget} onMove={handleTargetMove} />}

            <Html fullscreen pointerEvents="none">
                {/* Left Panel: Controls */}
                <ControlPanel
                    hasBlock={hasBlock} isGripping={isGripping}
                    dist={ikTarget.distanceTo(blockPosRef.current)}
                    autoPhase={autoPhase} startAuto={startAutoSequence}
                    toggleGripper={() => {
                        if(hasBlock) { setHasBlock(false); setIsGripping(false); }
                        else { setIsGripping(true); if(ikTarget.distanceTo(blockPosRef.current)<1.5) setHasBlock(true); }
                    }}
                />

                {/* Right Panel: Telemetry Graph */}
                <TelemetryPanel data={telemetryData} />
            </Html>
        </>
    );
}

// --- UI COMPONENTS ---
function ControlPanel({ hasBlock, isGripping, toggleGripper, dist, autoPhase, startAuto }: any) {
    const isAuto = autoPhase !== 'IDLE';
    return (
        <div className="absolute top-10 left-10 w-72 bg-white/95 shadow-xl border border-gray-200 p-6 rounded-xl backdrop-blur-sm pointer-events-auto">
            <h1 className="text-xl font-bold text-gray-800 mb-4">Control Unit</h1>
            <div className="flex justify-between items-center mb-4 bg-gray-50 p-2 rounded">
                <span className="text-xs font-bold text-gray-500">MODE</span>
                <span className={`text-xs font-bold ${isAuto ? 'text-purple-600 animate-pulse' : 'text-gray-600'}`}>
                {isAuto ? autoPhase : 'MANUAL'}
            </span>
            </div>
            <button onClick={startAuto} disabled={isAuto || hasBlock} className={`w-full mb-3 py-3 rounded-lg font-bold text-sm shadow-sm transition-all ${isAuto || hasBlock ? 'bg-gray-200 text-gray-400' : 'bg-purple-600 text-white hover:bg-purple-700'}`}>
                {isAuto ? 'RUNNING...' : 'AUTO SEQ'}
            </button>
            <button onClick={toggleGripper} disabled={isAuto} className={`w-full py-3 rounded-lg font-bold text-sm shadow-sm ${isGripping ? 'bg-gray-800 text-white' : 'bg-blue-600 text-white'}`}>
                {isGripping ? 'RELEASE' : 'GRAB'}
            </button>
        </div>
    );
}

function TelemetryPanel({ data }: { data: any[] }) {
    return (
        <div className="absolute top-10 right-10 w-80 bg-white/95 shadow-xl border border-gray-200 p-6 rounded-xl backdrop-blur-sm pointer-events-auto">
            <h2 className="text-sm font-bold text-gray-500 mb-2 uppercase tracking-wide">Joint Telemetry</h2>
            <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data}>
                        <XAxis dataKey="time" hide />
                        <YAxis domain={[0, 'auto']} hide />
                        <Tooltip contentStyle={{ fontSize: '12px' }} />
                        <Line type="monotone" dataKey="velocity" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey="torque" stroke="#82ca9d" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            <div className="flex justify-between mt-2 text-xs font-bold">
                <span className="text-purple-400">● Velocity</span>
                <span className="text-green-400">● Motor Load</span>
            </div>
        </div>
    );
}

function TargetControl({ position, onMove }: any) {
    return (
        <TransformControls position={position} onObjectChange={(e: any) => onMove(e.target.object.position)}>
            <mesh visible={false}><sphereGeometry args={[0.1]} /></mesh>
        </TransformControls>
    );
}

export default function RobotPage() {
    return (
        <div className="w-screen h-screen bg-white relative">
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                <color attach="background" args={['#ffffff']} />
                <ambientLight intensity={0.6} />
                <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                <Grid infiniteGrid sectionColor="#e5e7eb" cellColor="#f3f4f6" fadeDistance={30} />
                <RobotController />
                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
}