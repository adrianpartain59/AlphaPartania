import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { revealFactor } from '../data/projects'
import { useStore } from '../store/useStore'

/* ------------------------------ tuning ----------------------------------- */
const COUNT = 3600

// Two irregular belts between the planet orbits. `lobes`/`wobble` make them
// non-circular (liquid-like standing waves the particles flow through).
const BANDS = [
  { radius: 20, spread: 3.2, lobes: 3, wobble: 1.7, tilt: 0.05 },
  { radius: 32, spread: 3.8, lobes: 4, wobble: 2.2, tilt: -0.04 },
]

const FLOW_K = 0.55 // overall orbital flow speed (inner flows faster)
const LOBE_DRIFT = 0.05 // how fast the standing-wave shape morphs

// Gas-like mouse interaction (overdamped spring so it pushes out then drifts
// smoothly back — no springy overshoot).
const INFLUENCE = 7.5
const STRENGTH = 24 // outward acceleration near the cursor
const SPRING = 4 // pull back toward home
const DAMP = 5 // velocity damping (DAMP² > 4·SPRING ⇒ overdamped)
const MAX_DELTA = 0.05 // clamp huge frame gaps (tab switches) for stability

function useSpriteTexture() {
  return useMemo(() => {
    const s = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = s
    const ctx = canvas.getContext('2d')
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.45, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

const gaussian = () =>
  (Math.random() + Math.random() + Math.random() - 1.5) / 1.5

/**
 * Flowing cosmic-dust belts that orbit the sun. Distinct from the starfield:
 * clustered into irregular rings, larger and softer, and continuously flowing
 * (inner belt faster) like sheared liquid. The cursor parts them with a smooth,
 * gaseous motion via a per-particle overdamped spring driven by a raycast onto
 * the system plane.
 */
const DUST_OPACITY = 0.55

export default function DustRings() {
  const pointsRef = useRef(null)
  const matRef = useRef(null)
  const sprite = useSpriteTexture()

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const angle = new Float32Array(COUNT)
    const baseR = new Float32Array(COUNT)
    const yOff = new Float32Array(COUNT)
    const angSpeed = new Float32Array(COUNT)
    const seed = new Float32Array(COUNT)
    const lobes = new Float32Array(COUNT)
    const wobble = new Float32Array(COUNT)
    // Live state.
    const disp = new Float32Array(COUNT * 3)
    const vel = new Float32Array(COUNT * 3)

    const color = new THREE.Color()

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const band = BANDS[i % BANDS.length]
      const r = band.radius + gaussian() * band.spread
      const a = Math.random() * Math.PI * 2

      angle[i] = a
      baseR[i] = r
      yOff[i] = gaussian() * 0.95 + Math.sin(a) * (band.tilt * r)
      angSpeed[i] = (FLOW_K / Math.sqrt(r)) * (0.85 + Math.random() * 0.3)
      seed[i] = Math.random() * Math.PI * 2
      lobes[i] = band.lobes
      wobble[i] = band.wobble

      // Seed the buffer with the resting position.
      const rr = r + Math.sin(a * band.lobes + seed[i]) * band.wobble
      positions[ix] = Math.cos(a) * rr
      positions[ix + 1] = yOff[i]
      positions[ix + 2] = Math.sin(a) * rr

      // Cool cosmic dust, mostly cyan with white grains and a few warm meteors.
      const roll = Math.random()
      if (roll > 0.93) color.setHSL(0.08, 0.7, 0.66) // warm meteor speck
      else if (roll > 0.6) color.setHSL(0.54, 0.2, 0.85) // near-white
      else color.setHSL(0.55, 0.6, 0.62 + Math.random() * 0.12) // cyan dust
      colors[ix] = color.r
      colors[ix + 1] = color.g
      colors[ix + 2] = color.b
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return {
      geometry,
      positions,
      angle,
      baseR,
      yOff,
      angSpeed,
      seed,
      lobes,
      wobble,
      disp,
      vel,
    }
  }, [])

  const scratch = useMemo(
    () => ({ plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit: new THREE.Vector3() }),
    [],
  )

  useFrame((state, rawDelta) => {
    const points = pointsRef.current
    if (!points) return

    // The dust belts are part of the "detail" layer — invisible in the wireframe
    // overview and fading in as the camera closes on the system.
    if (matRef.current) {
      matRef.current.opacity = DUST_OPACITY * revealFactor(useStore.getState().progress)
    }

    const delta = Math.min(rawDelta, MAX_DELTA)
    const t = state.clock.elapsedTime
    const { positions, angle, baseR, yOff, angSpeed, seed, lobes, wobble, disp, vel } =
      data

    // Mouse → point on the system plane (y = 0).
    const { camera, pointer, raycaster } = state
    raycaster.setFromCamera(pointer, camera)
    const hasHit = !!raycaster.ray.intersectPlane(scratch.plane, scratch.hit)
    const mx = scratch.hit.x
    const my = scratch.hit.y
    const mz = scratch.hit.z
    const infl2 = INFLUENCE * INFLUENCE

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3

      // Flowing base position (orbit + morphing radial wobble).
      angle[i] += angSpeed[i] * delta
      const a = angle[i]
      const r = baseR[i] + Math.sin(a * lobes[i] + seed[i] + t * LOBE_DRIFT) * wobble[i]
      const bx = Math.cos(a) * r
      const by = yOff[i]
      const bz = Math.sin(a) * r

      let dx = disp[ix]
      let dy = disp[ix + 1]
      let dz = disp[ix + 2]
      let vx = vel[ix]
      let vy = vel[ix + 1]
      let vz = vel[ix + 2]

      // Repulsion impulse when the cursor is near (gaslike outward shove).
      if (hasHit) {
        const rx = bx + dx - mx
        const ry = by + dy - my
        const rz = bz + dz - mz
        const d2 = rx * rx + ry * ry + rz * rz
        if (d2 < infl2) {
          const d = Math.sqrt(d2) || 0.0001
          const f = 1 - d / INFLUENCE
          const force = f * f * STRENGTH
          vx += (rx / d) * force * delta
          vy += (ry / d) * force * delta * 0.4
          vz += (rz / d) * force * delta
        }
      }

      // Overdamped spring back to the flowing home position.
      vx += (-SPRING * dx - DAMP * vx) * delta
      vy += (-SPRING * dy - DAMP * vy) * delta
      vz += (-SPRING * dz - DAMP * vz) * delta
      dx += vx * delta
      dy += vy * delta
      dz += vz * delta

      disp[ix] = dx
      disp[ix + 1] = dy
      disp[ix + 2] = dz
      vel[ix] = vx
      vel[ix + 1] = vy
      vel[ix + 2] = vz

      positions[ix] = bx + dx
      positions[ix + 1] = by + dy
      positions[ix + 2] = bz + dz
    }

    points.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={pointsRef} geometry={data.geometry} frustumCulled={false}>
      <pointsMaterial
        ref={matRef}
        map={sprite}
        size={0.32}
        sizeAttenuation
        vertexColors
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0}
      />
    </points>
  )
}
