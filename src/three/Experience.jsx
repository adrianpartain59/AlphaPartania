import { Suspense, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import { projects, sceneConfig, revealFactor } from '../data/projects'
import { useStore } from '../store/useStore'
import Lighting from './Lighting'
import Starfield from './Starfield'
import DustRings from './DustRings'
import Sun from './Sun'
import TerrainWave from './TerrainWave'
import ProjectPlanet from './ProjectPlanet'
import CameraRig from './CameraRig'
import Effects from './Effects'

/**
 * Orbit guide-rings on the system plane — the top-down "solar system" read.
 * Part of the wireframe state: bright white lines tracing each planet's path
 * while you're zoomed out, fading away as the camera closes in.
 */
function OrbitPaths() {
  const matRefs = useRef([])

  useFrame(() => {
    const reveal = revealFactor(useStore.getState().progress)
    const opacity = (1 - reveal) * 0.4
    for (const mat of matRefs.current) {
      if (mat) mat.opacity = opacity
    }
  })

  return projects.map((p, i) => (
    <mesh key={p.id} rotation={[-Math.PI / 2, 0, 0]} position={[0, p.orbitY, 0]}>
      <torusGeometry args={[p.orbitRadius, 0.02, 8, 220]} />
      <meshBasicMaterial
        ref={(el) => (matRefs.current[i] = el)}
        color="#ffffff"
        transparent
        opacity={0.4}
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
        <Sun />
        <DustRings />
        <TerrainWave />
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
