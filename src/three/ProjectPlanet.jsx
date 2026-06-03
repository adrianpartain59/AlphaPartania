import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { sceneConfig, planetOrbitPosition } from '../data/projects'
import { makeLogoTexture } from './textTexture'

/**
 * One project, rendered as an orbiting "planet":
 *
 *   • Gyroscope cage — three thin, solid-white rings tumbling on different axes
 *     like a gimbal. Unlit (MeshBasicMaterial) so nothing reflects off them.
 *   • Glass core — a small MeshTransmissionMaterial sphere that refracts…
 *   • the logo — a billboarded, canvas-rendered project name inside the core.
 *
 * The whole group rides its orbit around the sun (position resolved every frame
 * from the shared orbit helper, so the camera rig can track it exactly).
 */
export default function ProjectPlanet({ project }) {
  const groupRef = useRef(null)
  const ringARef = useRef(null)
  const ringBRef = useRef(null)
  const ringCRef = useRef(null)

  const gyroR = sceneConfig.planet.gyroRadius
  const coreR = sceneConfig.planet.coreRadius

  const { texture: logoTexture } = useMemo(
    () =>
      makeLogoTexture({
        name: project.name,
        label: `Project 0${project.id}`,
        accent: project.accent,
      }),
    [project],
  )
  useEffect(() => () => logoTexture.dispose(), [logoTexture])

  const scratch = useMemo(() => [0, 0, 0], [])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Ride the orbit.
    const group = groupRef.current
    if (group) {
      planetOrbitPosition(project, t, scratch)
      group.position.set(scratch[0], scratch[1], scratch[2])
    }

    // Tumble the three rings on distinct axes → gyroscope motion.
    if (ringARef.current) ringARef.current.rotation.x += delta * 0.6
    if (ringBRef.current) ringBRef.current.rotation.y += delta * 0.8
    if (ringCRef.current) {
      ringCRef.current.rotation.y += delta * 0.45
      ringCRef.current.rotation.x += delta * 0.3
    }
  })

  return (
    <group ref={groupRef}>
      {/* ---- Gyroscope rings (thin, solid white, unlit) ---- */}
      <mesh ref={ringARef}>
        <torusGeometry args={[gyroR, 0.018, 16, 128]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={ringBRef}>
        <torusGeometry args={[gyroR * 0.88, 0.016, 16, 128]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh ref={ringCRef} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[gyroR * 0.76, 0.014, 16, 128]} />
        <meshBasicMaterial color="#f2f8ff" toneMapped={false} />
      </mesh>

      {/* ---- Refractive glass core ---- */}
      <mesh>
        <sphereGeometry args={[coreR, 64, 64]} />
        <MeshTransmissionMaterial
          samples={6}
          resolution={256}
          transmission={1}
          roughness={0.12}
          thickness={1.1}
          ior={1.4}
          chromaticAberration={0.06}
          anisotropicBlur={0.3}
          distortion={0.16}
          distortionScale={0.25}
          temporalDistortion={0.05}
          attenuationColor={project.accent}
          attenuationDistance={2.0}
          color="#ffffff"
          backside={false}
        />
      </mesh>

      {/* ---- Logo inside the glass (billboarded → stays readable) ---- */}
      <Billboard>
        <mesh>
          <planeGeometry args={[coreR * 1.34, coreR * 1.34]} />
          <meshBasicMaterial
            map={logoTexture}
            transparent
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>

      {/* Subtle accent glow so the core reads as a coloured gem. */}
      <pointLight color={project.accent} intensity={4} distance={8} decay={2} />
    </group>
  )
}
