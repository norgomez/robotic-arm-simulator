'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid, TransformControls, Html, Line } from '@react-three/drei';
import { useState, useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { LineChart, Line as RechartsLine, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { RobotArm } from '../components/RobotArm';
import { solveIK } from '../utils/kinematics';

// --- TYPES ---
type Waypoint = { pos: THREE.Vector3; grip: boolean; };
type BlockType = { id: number; initialPos: [number, number, number]; color: string; };

// --- CONFIG ---
const INITIAL_BLOCKS: BlockType[] = [
    { id: 1, initialPos: [4, 0.5, 4], color: '#3b82f6' }, // Blue
    { id: 2, initialPos: [4, 0.5, -2], color: '#ef4444' } // Red
];

// --- MATH HELPER ---
const lerp = (start: number, end: number, speed: number) => start + (end - start) * speed;

// --- 1. The Interactive Block Component (FIXED) ---
function Block({ data, attachedId, targetPosition, resetKey, onPosUpdate }: any) {
    const meshRef = useRef<THREE.Mesh>(null);

    // FIX 1: Pass coordinates individually instead of spreading (...data.initialPos)
    const position = useRef(new THREE.Vector3(data.initialPos[0], data.initialPos[1], data.initialPos[2]));
    const velocityY = useRef(0);

    // Reset logic
    useEffect(() => {
        // FIX 2: Pass coordinates individually here too
        position.current.set(data.initialPos[0], data.initialPos[1], data.initialPos[2]);
        velocityY.current = 0;
    }, [resetKey, data.initialPos]);

    useFrame(() => {
        if (!meshRef.current) return;

        const isAttached = attachedId === data.id;

        if (isAttached) {
            // Follow Robot
            position.current.copy(targetPosition);
            velocityY.current = 0;
        } else {
            // Gravity
            if (position.current.y > 0.5) {
                velocityY.current -= 0.02;
                position.current.y += velocityY.current;
            }
            // Floor Collision
            if (position.current.y <= 0.5) {
                position.current.y = 0.5;
                velocityY.current = 0;
            }
        }

        meshRef.current.position.copy(position.current);
        if (onPosUpdate) onPosUpdate(data.id, position.current);
    });

    return (
        <mesh ref={meshRef} castShadow receiveShadow>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={attachedId === data.id ? "#fbbf24" : data.color} />
            <Html position={[0, 1, 0]} center distanceFactor={10}>
                <div className="text-[8px] font-bold text-white bg-black/40 px-1 rounded">ID: {data.id}</div>
            </Html>
        </mesh>
    );
}

// --- 2. Drop Zones ---
function DropZones() {
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

// --- 3. Waypoint Visualizer ---
function WaypointVisualizer({ waypoints }: { waypoints: Waypoint[] }) {
    const points = useMemo(() => waypoints.map(wp => [wp.pos.x, wp.pos.y, wp.pos.z] as [number, number, number]), [waypoints]);
    return (
        <>
            {points.length > 1 && <Line points={points} color="cyan" lineWidth={1} dashed dashScale={2} opacity={0.5} transparent />}
            {waypoints.map((wp, i) => (
                <mesh key={i} position={wp.pos}>
                    <sphereGeometry args={[0.15]} />
                    <meshBasicMaterial color={wp.grip ? "#4ade80" : "#06b6d4"} opacity={0.6} transparent />
                    <Html position={[0, 0.2, 0]} center><div className="text-[8px] font-mono text-white bg-black/50 px-1 rounded">{i + 1}</div></Html>
                </mesh>
            ))}
        </>
    );
}

// --- 4. Main Logic Wrapper ---
function RobotController() {
    const [ikTarget, setIkTarget] = useState(new THREE.Vector3(2, 2, 2));
    const [smoothAngles, setSmoothAngles] = useState({ base: 0, shoulder: 0, elbow: 0 });
    const desiredAngles = useRef({ base: 0, shoulder: 0, elbow: 0 });

    // LOGIC STATE
    const [isGripping, setIsGripping] = useState(false);
    const [attachedBlockId, setAttachedBlockId] = useState<number | null>(null);
    const [mode, setMode] = useState<'MANUAL' | 'AUTO_PICK' | 'REPLAY'>('MANUAL');
    const [autoPhase, setAutoPhase] = useState('IDLE');
    const [resetKey, setResetKey] = useState(0);

    // DATA
    const [waypoints, setWaypoints] = useState<Waypoint[]>([]);
    const [replayIndex, setReplayIndex] = useState(0);
    const [telemetryData, setTelemetryData] = useState<any[]>([]);

    // REFS
    const blockPositions = useRef(new Map<number, THREE.Vector3>());
    const prevAngles = useRef({ base: 0, shoulder: 0, elbow: 0 });
    const frameCount = useRef(0);
    const targetBlockIdForAuto = useRef(1);

    useFrame((state, delta) => {
        // 1. Interpolation
        const newAngles = {
            base: lerp(smoothAngles.base, desiredAngles.current.base, 0.1),
            shoulder: lerp(smoothAngles.shoulder, desiredAngles.current.shoulder, 0.1),
            elbow: lerp(smoothAngles.elbow, desiredAngles.current.elbow, 0.1)
        };
        setSmoothAngles(newAngles);

        // 2. Telemetry
        frameCount.current++;
        if (frameCount.current % 5 === 0) {
            const velocity = Math.abs((newAngles.shoulder - prevAngles.current.shoulder) / delta);
            const torque = Math.abs(Math.cos(newAngles.shoulder) + (attachedBlockId ? 1.5 : 0));
            setTelemetryData(prev => {
                const newData = [...prev, { time: frameCount.current, velocity, torque }];
                if (newData.length > 40) newData.shift();
                return newData;
            });
        }
        prevAngles.current = newAngles;

        // 3. AUTO PICK LOGIC
        if (mode === 'AUTO_PICK') {
            const speed = 6 * delta;
            let targetDest = new THREE.Vector3();
            let nextPhase = autoPhase;
            const threshold = 0.1;

            const targetBlockPos = blockPositions.current.get(targetBlockIdForAuto.current) || new THREE.Vector3(4, 0.5, 4);

            switch (autoPhase) {
                case 'IDLE': nextPhase = 'APPROACH'; break;
                case 'APPROACH':
                    targetDest.set(targetBlockPos.x, targetBlockPos.y + 2, targetBlockPos.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'DESCEND';
                    break;
                case 'DESCEND':
                    targetDest.set(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) {
                        setIsGripping(true);
                        setAttachedBlockId(targetBlockIdForAuto.current);
                        nextPhase = 'LIFT';
                    }
                    break;
                case 'LIFT':
                    targetDest.set(targetBlockPos.x, 3, targetBlockPos.z);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'MOVE_TO_ZONE';
                    break;
                case 'MOVE_TO_ZONE':
                    targetDest.set(-4, 3, 2);
                    if (ikTarget.distanceTo(targetDest) < threshold) nextPhase = 'LOWER_TO_DROP';
                    break;
                case 'LOWER_TO_DROP':
                    targetDest.set(-4, 0.8, 2);
                    if (ikTarget.distanceTo(targetDest) < threshold) {
                        setIsGripping(false); setAttachedBlockId(null); nextPhase = 'RETRACT';
                    }
                    break;
                case 'RETRACT':
                    targetDest.set(0, 3, 0);
                    if (ikTarget.distanceTo(targetDest) < threshold) { setMode('MANUAL'); setAutoPhase('IDLE'); }
                    break;
            }
            if (mode === 'AUTO_PICK' && autoPhase !== 'IDLE') {
                moveTowards(targetDest, speed);
                if (nextPhase !== autoPhase) setAutoPhase(nextPhase);
            }
        }

        // 4. REPLAY MODE
        if (mode === 'REPLAY') {
            if (waypoints.length === 0) { setMode('MANUAL'); return; }
            const targetPoint = waypoints[replayIndex];
            moveTowards(targetPoint.pos, 4 * delta);

            if (ikTarget.distanceTo(targetPoint.pos) < 0.1) {
                if (targetPoint.grip !== isGripping) {
                    if (targetPoint.grip) tryGrabClosest();
                    else { setIsGripping(false); setAttachedBlockId(null); }
                }
                setReplayIndex((replayIndex + 1) % waypoints.length);
            }
        }
    });

    const moveTowards = (dest: THREE.Vector3, speed: number) => {
        const dir = new THREE.Vector3().subVectors(dest, ikTarget).normalize();
        handleTargetMove(ikTarget.clone().add(dir.multiplyScalar(speed)));
    };

    const handleTargetMove = (newPos: THREE.Vector3) => {
        setIkTarget(newPos);
        const solution = solveIK(newPos.x, newPos.y, newPos.z);
        if (solution) desiredAngles.current = solution;
    };

    const tryGrabClosest = () => {
        setIsGripping(true);
        let closestId = null;
        let minDst = 1.5;

        blockPositions.current.forEach((pos, id) => {
            const dist = ikTarget.distanceTo(pos);
            if (dist < minDst) {
                minDst = dist;
                closestId = id;
            }
        });

        if (closestId) setAttachedBlockId(closestId);
    };

    const toggleGripper = () => {
        if(attachedBlockId) {
            setAttachedBlockId(null); setIsGripping(false);
        } else {
            tryGrabClosest();
        }
    };

    const handleReset = () => {
        setMode('MANUAL');
        setAutoPhase('IDLE');
        setIsGripping(false);
        setAttachedBlockId(null);
        setIkTarget(new THREE.Vector3(2, 2, 2));
        setWaypoints([]);
        setResetKey(prev => prev + 1);
    };

    const recordWaypoint = () => {
        setWaypoints(prev => [...prev, { pos: ikTarget.clone(), grip: isGripping }]);
    };

    const toggleReplay = () => {
        if (mode === 'REPLAY') setMode('MANUAL');
        else if (waypoints.length > 0) { setMode('REPLAY'); setReplayIndex(0); }
    };

    const getMinDist = () => {
        let min = 99;
        blockPositions.current.forEach((pos) => {
            const d = ikTarget.distanceTo(pos);
            if(d < min) min = d;
        });
        return min === 99 ? 0 : min;
    };
    const minDist = getMinDist();

    return (
        <>
            <RobotArm jointAngles={smoothAngles} isGripping={isGripping} />

            {INITIAL_BLOCKS.map(block => (
                <Block
                    key={block.id}
                    data={block}
                    resetKey={resetKey}
                    attachedId={attachedBlockId}
                    targetPosition={new THREE.Vector3(ikTarget.x, ikTarget.y - 0.75, ikTarget.z)}
                    onPosUpdate={(id: number, pos: THREE.Vector3) => blockPositions.current.set(id, pos.clone())}
                />
            ))}

            <DropZones />
            <WaypointVisualizer waypoints={waypoints} />
            {mode === 'MANUAL' && <TargetControl position={ikTarget} onMove={handleTargetMove} />}

            <Html fullscreen pointerEvents="none">

                {/* LEFT HUD */}
                <div className="absolute top-10 left-6 w-48 flex flex-col gap-2 pointer-events-auto">
                    <div className="bg-slate-900/80 backdrop-blur border-l-2 border-cyan-500 p-3 shadow-lg">
                        <h3 className="text-[10px] text-cyan-400 font-mono mb-2 tracking-widest">DIAGNOSTICS</h3>
                        <div className="space-y-2">
                            <DataRow label="BASE" value={(smoothAngles.base * 57.29).toFixed(0)} unit="°" />
                            <DataRow label="SHLDR" value={(smoothAngles.shoulder * 57.29).toFixed(0)} unit="°" />
                            <DataRow label="ELBOW" value={(smoothAngles.elbow * 57.29).toFixed(0)} unit="°" />
                        </div>
                    </div>
                </div>

                {/* RIGHT HUD */}
                <div className="absolute top-10 right-6 w-52 flex flex-col gap-2 pointer-events-auto">
                    <div className="bg-slate-900/80 backdrop-blur border-r-2 border-amber-500 p-3 shadow-lg text-right">
                        <h3 className="text-[10px] text-amber-500 font-mono mb-2 tracking-widest">COORDINATES</h3>
                        <div className="space-y-1 flex flex-col items-end">
                            <DataRow label="X" value={ikTarget.x.toFixed(2)} unit="m" />
                            <DataRow label="Y" value={ikTarget.y.toFixed(2)} unit="m" />
                            <DataRow label="Z" value={ikTarget.z.toFixed(2)} unit="m" />
                        </div>
                    </div>

                    <div className="bg-slate-900/80 backdrop-blur border-r-2 border-slate-500 p-3 shadow-lg text-right">
                        <h3 className="text-[10px] text-slate-400 font-mono tracking-widest mb-1">PROXIMITY (CLOSEST)</h3>
                        <div className="flex justify-end items-end gap-2">
                    <span className={`text-2xl font-mono font-bold ${minDist < 1.5 ? 'text-green-400' : 'text-slate-500'}`}>
                        {minDist.toFixed(2)}
                    </span>
                            <span className="text-xs text-slate-500 mb-1">m</span>
                        </div>
                        <div className="w-full h-1 bg-slate-700 mt-2 rounded overflow-hidden">
                            <div
                                className={`h-full transition-all duration-300 ${minDist < 1.5 ? 'bg-green-500' : 'bg-slate-500'}`}
                                style={{ width: `${Math.max(0, Math.min(100, (3 - minDist) * 33))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* BOTTOM COMMAND DECK */}
                <div className="absolute bottom-0 left-0 w-full h-40 bg-slate-900/95 border-t border-slate-700 backdrop-blur-xl flex pointer-events-auto">

                    {/* 1. TELEMETRY GRAPH */}
                    <div className="w-1/3 h-full p-4 border-r border-slate-700/50 relative">
                        <div className="absolute top-2 left-4 text-[10px] text-cyan-500 font-mono flex gap-4">
                            <span>LIVE DATA</span>
                            <span className="text-purple-400">● VEL</span>
                            <span className="text-green-400">● LOAD</span>
                        </div>
                        <div className="w-full h-full mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <RechartsLineChart data={telemetryData} />
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. MAIN OPERATIONS */}
                    <div className="w-1/3 h-full p-4 flex flex-col justify-center items-center gap-3 border-r border-slate-700/50">
                        <div className="flex items-center gap-2 mb-1">
                            <div className={`w-2 h-2 rounded-full ${mode !== 'MANUAL' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`} />
                            <span className="text-xs font-mono text-slate-300 tracking-wider">
                        MODE: <span className="text-white font-bold">{mode}</span>
                    </span>
                        </div>

                        <div className="flex w-full max-w-xs gap-2">
                            <button onClick={() => setMode('AUTO_PICK')} disabled={mode !== 'MANUAL'} className="flex-1 py-3 text-[10px] font-bold font-mono rounded transition-all border bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700">
                                AUTO PICK
                            </button>
                            <button onClick={toggleGripper} className={`flex-1 py-3 text-[10px] font-bold font-mono rounded transition-all border ${isGripping ? 'bg-amber-900/50 border-amber-500 text-amber-400' : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'}`}>
                                {isGripping ? 'RELEASE' : 'GRAB'}
                            </button>
                        </div>

                        <button onClick={handleReset} className="w-full max-w-xs py-1 text-[9px] font-bold font-mono text-red-500 bg-red-950/30 border border-red-900/50 hover:bg-red-900/50 rounded transition-all">
                            ⚠ RESET SYSTEM
                        </button>
                    </div>

                    {/* 3. PROGRAMMER UNIT */}
                    <div className="w-1/3 h-full p-6 flex flex-col justify-center gap-2">
                        <div className="flex justify-between text-[10px] text-cyan-400 font-mono mb-1 border-b border-slate-700 pb-1">
                            <span>TEACH PENDANT</span>
                            <span>POINTS: {waypoints.length}</span>
                        </div>
                        <div className="flex gap-2 h-12">
                            <button onClick={recordWaypoint} disabled={mode !== 'MANUAL'} className="flex-1 bg-slate-800 hover:bg-red-900/30 hover:border-red-500 border border-slate-600 rounded text-red-400 font-bold text-xs transition-all active:scale-95">● REC</button>
                            <button onClick={toggleReplay} disabled={waypoints.length === 0} className="flex-1 border bg-slate-800 border-slate-600 text-cyan-400 hover:bg-slate-700 rounded text-xs font-bold transition-all active:scale-95">
                                {mode === 'REPLAY' ? '■ STOP' : '▶ PLAY'}
                            </button>
                        </div>
                    </div>
                </div>

            </Html>
        </>
    );
}

// --- SUB COMPONENTS ---
function DataRow({ label, value, unit }: any) {
    return (
        <div className="flex justify-between items-center text-xs font-mono">
            <span className="text-slate-400">{label}</span>
            <span className="text-white">{value}<span className="text-slate-600 text-[9px] ml-1">{unit}</span></span>
        </div>
    );
}
function RechartsLineChart({ data }: { data: any[] }) {
    return (
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <XAxis dataKey="time" hide />
                <YAxis hide domain={[0, 'auto']} />
                <RechartsLine type="monotone" dataKey="velocity" stroke="#a78bfa" strokeWidth={2} dot={false} isAnimationActive={false} />
                <RechartsLine type="monotone" dataKey="torque" stroke="#4ade80" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
        </ResponsiveContainer>
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
        <div className="w-screen h-screen bg-black relative">
            <Canvas shadows camera={{ position: [8, 8, 8], fov: 45 }}>
                <color attach="background" args={['#0f172a']} />
                <ambientLight intensity={0.4} />
                <directionalLight position={[5, 10, 5]} intensity={1.5} castShadow />
                <Grid infiniteGrid sectionColor="#1e293b" cellColor="#334155" fadeDistance={30} />
                <RobotController />
                <OrbitControls makeDefault />
            </Canvas>
        </div>
    );
}