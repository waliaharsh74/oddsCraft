
'use client';
import { Canvas, useFrame, extend, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import * as THREE from 'three';
import { OrbitControls } from '@three-ts/orbit-controls';

// make OrbitControls available as <orbitControls />
extend({ OrbitControls });

function Controls(){
  const { camera, gl } = useThree();
  const ref = useRef(null);
  useEffect(()=>{ (ref.current as any).update(); });
  //@ts-ignore
  return <orbitControls ref={ref} args={[camera, gl.domElement]} enableZoom={false} />;
}

function LogoMesh(){
  const group = useRef<THREE.Group>(null!);
  const cube  = useRef<THREE.Mesh>(null!);
  const torus = useRef<THREE.Mesh>(null!);

  useFrame(({ clock })=>{
    cube.current.rotation.y = clock.elapsedTime * 0.4;
    torus.current.rotation.x = clock.elapsedTime * 0.5;
  });

  useEffect(()=>{
    const tl = gsap.timeline({ defaults:{ ease: 'power4.out', duration: 1 }});
    tl.from(group.current.position, { z: -6, opacity: 0 })
      .from(cube.current.material, { opacity: 0 }, 0)
      .from(torus.current.material, { opacity: 0 }, 0.2)
      .to(group.current.rotation, { y: Math.PI * 2, duration: 4, ease: 'none' }, 0.5);
  }, []);

  return (
    <group ref={group} position={[0,0,0]}>
      <mesh ref={cube}>
        <boxGeometry args={[1.4,1.4,1.4]} />
        <meshStandardMaterial color={'#ec4899'} transparent />
      </mesh>
      <mesh ref={torus} rotation={[Math.PI/2,0,0]}>
        <torusGeometry args={[2.2,0.15,16,40]} />
        <meshStandardMaterial color={'#38bdf8'} transparent />
      </mesh>
    </group>
  );
}

export default function LogoReveal(){
  return (
    <div className="w-full h-[300px]">
      <Canvas camera={{ position:[0,0,5], fov:40 }}>
        <ambientLight intensity={0.6}/>
        <directionalLight position={[3,3,3]} intensity={0.7}/>
        <LogoMesh />
        <Controls />
      </Canvas>
    </div>
  );
}
