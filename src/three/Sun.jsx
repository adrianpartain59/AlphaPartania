import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneConfig } from '../data/projects'
import { getMusicEnergy } from '../audio/audio'

/** Soft radial glow sprite for the corona (generated, no texture file). */
function useGlowTexture(color) {
  return useMemo(() => {
    const s = 256
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = s
    const ctx = canvas.getContext('2d')
    const c = new THREE.Color(color)
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, `rgba(${rgb},0.9)`)
    g.addColorStop(0.25, `rgba(${rgb},0.45)`)
    g.addColorStop(0.55, `rgba(${rgb},0.12)`)
    g.addColorStop(1, `rgba(${rgb},0)`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [color])
}

/**
 * The blue star at the heart of the system: an emissive core (so it blooms),
 * two additive corona sprites for a soft halo, and a central point light that
 * lights the planets' glass cores from the middle of the system.
 */
export default function Sun() {
  const { sun } = sceneConfig
  const groupRef = useRef(null)
  const coreRef = useRef(null)
  const innerGlowRef = useRef(null)
  const outerGlowRef = useRef(null)
  const lightRef = useRef(null)
  const energyRef = useRef(0)
  const glow = useGlowTexture(sun.coronaColor)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const music = getMusicEnergy()
    energyRef.current += (music - energyRef.current) * (music > energyRef.current ? 0.95 : 0.2)
    const beat = energyRef.current
    const bounce = 1 + beat * 0.42 + Math.sin(t * 12) * beat * 0.018

    if (groupRef.current) {
      groupRef.current.scale.setScalar(bounce)
    }

    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.05
      // Gentle "breathing" so the star feels alive.
      coreRef.current.material.emissiveIntensity =
        2.6 + Math.sin(t * 0.8) * 0.35 + beat * 4.8
    }
    if (innerGlowRef.current) {
      innerGlowRef.current.material.opacity = 0.9 + beat * 0.55
    }
    if (outerGlowRef.current) {
      outerGlowRef.current.material.opacity = 0.35 + beat * 0.5
    }
    if (lightRef.current) {
      lightRef.current.intensity = 650 + beat * 620
    }
  })

  return (
    <group ref={groupRef}>
      {/* Emissive core */}
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[sun.radius, 12]} />
        <meshStandardMaterial
          color="#0a2a4a"
          emissive={sun.color}
          emissiveIntensity={2.6}
          roughness={1}
          metalness={0}
          toneMapped={false}
        />
      </mesh>

      {/* Tight inner corona */}
      <sprite ref={innerGlowRef} scale={[sun.radius * 5, sun.radius * 5, 1]}>
        <spriteMaterial
          map={glow}
          color={sun.coronaColor}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.9}
        />
      </sprite>

      {/* Wide, faint outer corona */}
      <sprite ref={outerGlowRef} scale={[sun.radius * 11, sun.radius * 11, 1]}>
        <spriteMaterial
          map={glow}
          color={sun.color}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.35}
        />
      </sprite>

      {/* Central light that fills the system. */}
      <pointLight ref={lightRef} color={sun.color} intensity={650} distance={140} decay={2} />
    </group>
  )
}
