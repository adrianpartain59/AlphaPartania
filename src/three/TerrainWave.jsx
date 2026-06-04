import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'

/* ------------------------------ tuning ----------------------------------- */
// Flat square grid (local XY; group lays it flat & pins it to the camera).
const WIDTH = 200 // left↔right span
const DEPTH = 260 // toward↔away span (recedes to the horizon)
const SEG_X = 60 // grid columns
const SEG_Z = 90 // grid rows

// Where the grid sits relative to the camera (camera-local space).
const DROP = 7.5 // how far below the camera the floor sits
const PUSH = 12 // how far in front of the camera it starts
const TILT = 0.14 // slight pitch so the floor reads as receding ground

// Seamless scroll toward the viewer (units/sec). The grid slides by exactly one
// cell per cycle, so the wrap is invisible. Set to 0 for a static floor.
const SCROLL = 2.4

// Neon grid line colour (bright so the bloom pass blooms it).
const LINE = new THREE.Color('#e8f6ff')

// Screen-space "holes" — the grid fades aggressively where the hero copy and
// the HUD instrument cluster sit, so it never fights the UI. Boxes are in NDC
// (x,y ∈ [-1,1]; +y up, +x right) with a feather for a soft edge.
const UI_ZONES = [
  // Top-left hero text block (left third, title down through CTA button).
  { x0: -1.2, x1: -0.28, y0: -0.3, y1: 1.2, feather: 0.22 },
  // Bottom-right HUD / system cluster.
  { x0: 0.2, x1: 1.2, y0: -1.2, y1: -0.26, feather: 0.2 },
]

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0))
  return t * t * (3 - 2 * t)
}

/** Soft 0→1 membership of an NDC point inside a feathered box (1 = inside). */
function boxInfluence(nx, ny, z) {
  const ix = smoothstep(z.x0 - z.feather, z.x0, nx) * (1 - smoothstep(z.x1, z.x1 + z.feather, nx))
  const iy = smoothstep(z.y0 - z.feather, z.y0, ny) * (1 - smoothstep(z.y1, z.y1 + z.feather, ny))
  return ix * iy
}

/**
 * A flat neon square-grid floor that fills the lower frame of the landing shot
 * and scrolls gently toward the viewer. It's pinned to the camera (so it stays
 * put while the establishing shot holds) and fades out the instant the user
 * starts scrolling into the system — present only as a landing-page backdrop.
 *
 * Per-vertex alpha dissolves the grid toward the horizon, toward the screen
 * edges, and inside the hero/HUD screen zones so it never clutters the UI.
 */
export default function TerrainWave() {
  const camera = useThree((s) => s.camera)
  const groupRef = useRef(null)
  const matRef = useRef(null)

  const { geometry, base, cellY } = useMemo(() => {
    const nx = SEG_X + 1
    const nz = SEG_Z + 1
    const count = nx * nz
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 4)
    const base = new Float32Array(count * 2) // resting (x, y) per vertex

    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const v = j * nx + i
        const x = (i / (nx - 1) - 0.5) * WIDTH
        const y = (j / (nz - 1) - 0.5) * DEPTH
        base[v * 2] = x
        base[v * 2 + 1] = y
        positions[v * 3] = x
        positions[v * 3 + 1] = y
        positions[v * 3 + 2] = 0
        colors[v * 4] = LINE.r
        colors[v * 4 + 1] = LINE.g
        colors[v * 4 + 2] = LINE.b
        colors[v * 4 + 3] = 0
      }
    }

    // Square grid: connect each vertex to its right and bottom neighbour only
    // (no diagonals → square cells, not triangles).
    const indices = []
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const v = j * nx + i
        if (i < nx - 1) indices.push(v, v + 1)
        if (j < nz - 1) indices.push(v, v + nx)
      }
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 4))
    geo.setIndex(indices)

    return { geometry: geo, base, cellY: DEPTH / (nz - 1) }
  }, [])

  const offset = useMemo(() => new THREE.Vector3(0, -DROP, -PUSH), [])
  const scratch = useMemo(() => ({ mvp: new THREE.Matrix4(), v: new THREE.Vector3() }), [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const progress = useStore.getState().progress
    // Disappear almost immediately once scrolling begins.
    const vis = 1 - smoothstep(0, 0.02, progress)
    if (matRef.current) matRef.current.opacity = vis * 0.92

    if (vis <= 0.001) {
      group.visible = false
      return
    }
    group.visible = true

    // Pin to the camera: copy its pose, then push the floor forward, drop it
    // below eye level and pitch it flat so it recedes toward the horizon.
    group.position.copy(camera.position)
    group.quaternion.copy(camera.quaternion)
    group.translateX(offset.x)
    group.translateY(offset.y)
    group.translateZ(offset.z)
    group.rotateX(-Math.PI / 2 + TILT)
    group.updateMatrixWorld(true)

    // Combined model→clip matrix for the per-vertex screen-space UI fade.
    const { mvp, v } = scratch
    mvp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    mvp.multiply(group.matrixWorld)

    // Seamless scroll: shift the whole grid by < one cell, wrapping each cycle.
    const scroll = SCROLL > 0 ? (state.clock.elapsedTime * SCROLL) % cellY : 0

    const pos = geometry.attributes.position
    const col = geometry.attributes.color
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 2]
      const y = base[i * 2 + 1] - scroll
      pos.setY(i, y)

      // Depth fade (toward the far/top horizon).
      const yn = clamp01((y + DEPTH / 2) / DEPTH)
      const depthFade = Math.pow(1 - yn, 0.95)
      // Side fade in screen space (|x| / forward distance from the camera).
      const fwd = Math.max(PUSH + Math.cos(TILT) * y, 2)
      const sx = Math.abs(x) / fwd
      const edgeFade = 1 - smoothstep(0.18, 0.55, sx)

      // UI-zone fade: project to NDC and dissolve inside the hero/HUD boxes.
      v.set(x, y, 0).applyMatrix4(mvp)
      let uiFade = 1
      for (const zone of UI_ZONES) uiFade *= 1 - boxInfluence(v.x, v.y, zone)

      col.setW(i, depthFade * edgeFade * uiFade)
    }
    pos.needsUpdate = true
    col.needsUpdate = true
  })

  return (
    <group ref={groupRef} frustumCulled={false}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          ref={matRef}
          vertexColors
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}
