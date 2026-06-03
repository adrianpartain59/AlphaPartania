import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ------------------------------ tuning ----------------------------------- */
const COUNT = 1500
const INNER = 260 // inner radius of the star shell — kept far from the camera
const OUTER = 380 // outer radius

/** Soft round sprite so each star reads as a glowing dot, not a square. */
function useSpriteTexture() {
  return useMemo(() => {
    const s = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = s
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.8)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

/**
 * A large, slowly drifting spherical shell of stars that wraps the entire solar
 * system as a backdrop. Purely ambient now — the interactive particle work has
 * moved to the cosmic dust rings — so this stays cheap and static beyond a gentle
 * rotation that keeps the void feeling alive.
 */
export default function Starfield() {
  const groupRef = useRef(null)
  const sprite = useSpriteTexture()

  const geometry = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const color = new THREE.Color()
    const v = new THREE.Vector3()

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      // Even distribution of directions on the sphere.
      v.set(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      )
      if (v.lengthSq() < 1e-4) v.set(0, 0, 1)
      v.normalize().multiplyScalar(INNER + Math.random() * (OUTER - INNER))
      positions[ix] = v.x
      positions[ix + 1] = v.y
      positions[ix + 2] = v.z

      const roll = Math.random()
      if (roll > 0.9) {
        color.setHSL(0.55, 0.55, 0.78) // cool cyan ember
      } else if (roll > 0.82) {
        color.setHSL(0.74, 0.5, 0.74) // faint violet
      } else {
        const l = 0.68 + Math.random() * 0.32
        color.setRGB(l, l, l) // white → grey
      }
      colors[ix] = color.r
      colors[ix + 1] = color.g
      colors[ix + 2] = color.b
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [])

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.005
      groupRef.current.rotation.x += delta * 0.0015
    }
  })

  return (
    <group ref={groupRef}>
      <points geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          map={sprite}
          size={1.4}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.75}
        />
      </points>
    </group>
  )
}
