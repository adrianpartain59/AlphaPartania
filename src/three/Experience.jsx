import { Suspense, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Preload } from '@react-three/drei'
import * as THREE from 'three'
import { projects, sceneConfig, revealFactor } from '../data/projects'
import { useStore } from '../store/useStore'
import { systemAnchor } from './systemAnchor'
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

/**
 * Projects the solar-system centre (world origin) to screen pixels every frame
 * and records the camera distance, writing into the shared `systemAnchor` the
 * HTML overlay reads to keep the bottom-right HUD frame glued to the 3D system.
 */
function SystemAnchor() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const origin = useMemo(() => new THREE.Vector3(0, 0, 0), [])
  const ndc = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const dist = camera.position.distanceTo(origin)
    if (!systemAnchor.ready) systemAnchor.dist0 = dist
    systemAnchor.dist = dist

    ndc.copy(origin).project(camera)
    systemAnchor.x = (ndc.x * 0.5 + 0.5) * size.width
    systemAnchor.y = (-ndc.y * 0.5 + 0.5) * size.height
    systemAnchor.ready = true
  })

  return null
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
      <SystemAnchor />

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
