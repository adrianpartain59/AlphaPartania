import { forwardRef, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Html, MeshTransmissionMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { sceneConfig, planetOrbitPosition, revealFactor } from '../data/projects'
import { useStore } from '../store/useStore'
import { makeLogoTexture } from './textTexture'

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/**
 * A thin leader line drawn out from the planet to a small name label, like a
 * targeting annotation. `dir` mirrors it left/right so labels on right-side
 * planets read outward. Forwarded ref lets the parent fade it on scroll.
 */
const PlanetAnnotation = forwardRef(function PlanetAnnotation(
  { name, dir = 1 },
  ref,
) {
  const W = 200
  const H = 120
  const cx = W / 2
  const cy = H / 2
  const kneeX = cx + dir * 38
  const endX = cx + dir * 92
  const lineY = cy - 30

  return (
    <div
      ref={ref}
      style={{ position: 'relative', width: W, height: H, pointerEvents: 'none', willChange: 'opacity' }}
    >
      <svg
        width={W}
        height={H}
        style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}
      >
        <circle cx={cx} cy={cy} r={2.2} fill="#ffffff" />
        <circle cx={cx} cy={cy} r={6} fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <path
          d={`M${cx} ${cy} L${kneeX} ${lineY} L${endX} ${lineY}`}
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="1"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          // Sit the name just above the horizontal leader segment, anchored at
          // the elbow and growing outward so it's never clipped.
          top: lineY - 16,
          ...(dir === 1
            ? { left: kneeX + 4, textAlign: 'left' }
            : { right: W - kneeX + 4, textAlign: 'right' }),
          whiteSpace: 'nowrap',
          fontFamily: 'Orbitron, sans-serif',
          fontSize: 8,
          letterSpacing: '0.22em',
          color: 'rgba(255,255,255,0.92)',
          textShadow: '0 0 6px rgba(0,0,0,0.85)',
        }}
      >
        {name.toUpperCase()}
      </div>
    </div>
  )
})

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
  const outlineDiscRef = useRef(null)
  const outlineRingRef = useRef(null)
  const logoMatRef = useRef(null)
  const glowRef = useRef(null)
  const labelRef = useRef(null)

  const gyroR = sceneConfig.planet.gyroRadius
  const coreR = sceneConfig.planet.coreRadius
  // Outline ring weight mirrors the loading-screen planet style (~0.18 of R).
  const outlineW = coreR * 0.176

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

    // Crossfade the loading-screen-style outline (black disc + white ring) out
    // and the coloured glass/logo/glow in as the camera closes on the system.
    const progress = useStore.getState().progress
    const reveal = revealFactor(progress)
    if (outlineDiscRef.current) outlineDiscRef.current.opacity = 1 - reveal
    if (outlineRingRef.current) outlineRingRef.current.opacity = 1 - reveal
    if (logoMatRef.current) logoMatRef.current.opacity = reveal
    if (glowRef.current) glowRef.current.intensity = reveal * 4

    // Annotation label belongs to the zoomed-out establishing shot; fade it out
    // quickly as soon as the camera starts travelling in.
    if (labelRef.current) {
      labelRef.current.style.opacity = String(1 - smoothstep(0.006, 0.06, progress))
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
            ref={logoMatRef}
            map={logoTexture}
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>

      {/* ---- Wireframe state: a billboarded outlined sphere (filled black disc
              + white ring) exactly like the loading-screen planets. Drawn on top
              (no depth test) so it reads as a clean 2D circle and dissolves to
              reveal the glass core as you zoom in. ---- */}
      <Billboard>
        <mesh renderOrder={2}>
          <circleGeometry args={[coreR, 96]} />
          <meshBasicMaterial
            ref={outlineDiscRef}
            color="#000000"
            transparent
            opacity={1}
            depthTest={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh renderOrder={3}>
          <ringGeometry args={[coreR - outlineW, coreR + outlineW, 96]} />
          <meshBasicMaterial
            ref={outlineRingRef}
            color="#ffffff"
            transparent
            opacity={1}
            depthTest={false}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </Billboard>

      {/* Subtle accent glow so the core reads as a coloured gem. */}
      <pointLight ref={glowRef} color={project.accent} intensity={0} distance={8} decay={2} />

      {/* ---- Annotation: leader line + name label (establishing shot only) ---- */}
      <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <PlanetAnnotation
          ref={labelRef}
          name={project.name}
          dir={project.side === 'right' ? -1 : 1}
        />
      </Html>
    </group>
  )
}
