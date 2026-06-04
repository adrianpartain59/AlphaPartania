import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import { projects, sceneConfig } from '../data/projects'
import { useStore } from '../store/useStore'
import Lighting from './Lighting'
import Starfield from './Starfield'
import DustRings from './DustRings'
import MilkyWayChannel from './MilkyWayChannel'
import Sun from './Sun'
import ProjectPlanet from './ProjectPlanet'
import CameraRig from './CameraRig'
import Effects from './Effects'

/** Faint orbit guide-rings on the system plane — the top-down "solar system" read. */
function OrbitPaths() {
  return projects.map((p) => (
    <mesh key={p.id} rotation={[-Math.PI / 2, 0, 0]} position={[0, p.orbitY, 0]}>
      <torusGeometry args={[p.orbitRadius, 0.02, 8, 220]} />
      <meshBasicMaterial
        color="#46d6ff"
        transparent
        opacity={0.12}
        toneMapped={false}
      />
    </mesh>
  ))
}

/** Flips `ready` after the first couple of frames (heavy shaders compiled). */
function SceneReady() {
  const frames = useRef(0)
  const setReady = useStore((s) => s.setReady)
  useFrame(() => {
    frames.current += 1
    if (frames.current === 2) setReady(true)
  })
  return null
}

/** Everything inside the <Canvas>. */
export default function Experience() {
  return (
    <>
      <color attach="background" args={[sceneConfig.background]} />

      <CameraRig />

      <Suspense fallback={null}>
        <Lighting />
        <Starfield />
        <MilkyWayChannel />
        <Sun />
        <DustRings />
        <OrbitPaths />

        {projects.map((project) => (
          <ProjectPlanet key={project.id} project={project} />
        ))}

        <Preload all />
      </Suspense>

      <Effects />
      <SceneReady />
    </>
  )
}
