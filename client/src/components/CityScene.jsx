import { Canvas, useFrame } from '@react-three/fiber';
import { Float, OrbitControls, Sparkles } from '@react-three/drei';
import { useMemo, useRef } from 'react';

const buildingData = [
  [-2.1, -0.15, 0.5, 1.65, '#18d8c1'],
  [-1.35, 0.25, 0.7, 1.05, '#5c8dff'],
  [-0.55, -0.15, 0.95, 1.8, '#9b7cff'],
  [0.45, 0.35, 0.55, 1.25, '#18d8c1'],
  [1.25, -0.15, 0.75, 1.95, '#5c8dff'],
  [2.05, 0.25, 0.35, 1.15, '#9b7cff'],
  [-1.65, 0.75, -0.65, 1.1, '#5c8dff'],
  [-0.45, 0.85, -0.5, 1.65, '#18d8c1'],
  [0.65, 0.75, -0.7, 1.25, '#9b7cff'],
  [1.85, 0.75, -0.55, 1.8, '#18d8c1'],
];

function Building({ position, height, color }) {
  const windows = useMemo(() => Array.from({ length: 8 }, (_, windowIndex) => windowIndex), []);

  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[0.72, height, 0.72]} />
        <meshStandardMaterial color="#071a2b" metalness={0.85} roughness={0.2} emissive={color} emissiveIntensity={0.13} />
      </mesh>
      {windows.map((windowIndex) => (
        <mesh key={windowIndex} position={[0, 0.22 + (windowIndex % 4) * 0.45, 0.37]}>
          <boxGeometry args={[0.18, 0.12, 0.025]} />
          <meshBasicMaterial color={windowIndex % 3 === 0 ? color : '#a5fff2'} transparent opacity={windowIndex % 3 === 0 ? 0.65 : 0.28} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.12, 0]} rotation={[0, Math.PI / 4, 0]}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, height * 0.38, 0.38]}>
        <boxGeometry args={[0.42, 0.035, 0.025]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

function City() {
  const group = useRef();
  const orbit = useRef();

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    if (group.current) {
      group.current.rotation.y = Math.sin(time * 0.24) * 0.12;
      group.current.position.y = Math.sin(time * 0.55) * 0.11;
    }
    if (orbit.current) orbit.current.rotation.z = time * 0.035;
  });

  return (
    <group ref={group} rotation={[0.06, -0.24, 0]}>
      <mesh position={[0, -1.15, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[4.1, 4.6, 0.28, 96]} />
        <meshStandardMaterial color="#09243a" metalness={0.7} roughness={0.22} />
      </mesh>

      <mesh position={[0, -0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.55, 2.68, 96]} />
        <meshBasicMaterial color="#52f5d5" transparent opacity={0.7} />
      </mesh>

      {buildingData.map(([x, y, z, height, color], index) => (
        <Building key={index} position={[x, y, z]} height={height} color={color} index={index} />
      ))}

      <group ref={orbit} position={[0, 0.15, 0]}>
        <Float speed={2.2} rotationIntensity={0.35} floatIntensity={0.7}>
          <mesh position={[2.8, 0.9, 0.2]}>
            <torusGeometry args={[0.22, 0.045, 16, 64]} />
            <meshBasicMaterial color="#62f5d7" />
          </mesh>
        </Float>
        <mesh position={[2.85, 0.95, 0.2]}>
          <sphereGeometry args={[0.08, 24, 24]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      </group>

      <Sparkles count={90} scale={[9, 5, 5]} size={1.5} speed={0.5} color="#7cf7df" opacity={0.75} />
    </group>
  );
}

export default function CityScene() {
  return (
    <Canvas camera={{ position: [0, 0.4, 8.1], fov: 38 }} dpr={[1, 1.8]} gl={{ antialias: true, alpha: true }}>
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 5]} intensity={2.2} color="#86fff0" />
      <pointLight position={[-4, 1, 2]} intensity={7} color="#4d7cff" />
      <pointLight position={[4, -1, 1]} intensity={5} color="#15d9bd" />
      <City />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} minPolarAngle={Math.PI / 3} maxPolarAngle={Math.PI / 2.2} />
    </Canvas>
  );
}
