import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneConfig } from '../data/projects'

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
  const coreRef = useRef(null)
  const glow = useGlowTexture(sun.coronaColor)

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 0.05
      // Gentle "breathing" so the star feels alive.
      coreRef.current.material.emissiveIntensity = 2.6 + Math.sin(t * 0.8) * 0.35
    }
  })

  return (
    <group>
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
      <sprite scale={[sun.radius * 5, sun.radius * 5, 1]}>
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
      <sprite scale={[sun.radius * 11, sun.radius * 11, 1]}>
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
      <pointLight color={sun.color} intensity={650} distance={140} decay={2} />
    </group>
  )
}
