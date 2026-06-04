import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { sceneConfig, revealFactor } from '../data/projects'
import { useStore } from '../store/useStore'

/* ------------------------------ tuning ----------------------------------- */
// A Space-Shuttle-orbiter silhouette built from simple shapes: a tapered
// rounded fuselage (stacked cross-section rings), double-delta wings, a swept
// vertical tail, two OMS pods and a cluster of three engine nozzles.
// Nose points toward -Z, tail toward +Z, wings span X, up is +Y.

// Where the ship floats in the 3D scene: just above the central star.
const HOVER = sceneConfig.sun.radius + 2.9

const LINE = '#cfeaff'

/** Linear interpolate between two [x,y,z] points. */
const lerp3 = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]

/**
 * A wireframe Space Shuttle orbiter: pure neon line-art so it matches the
 * scene's wireframe aesthetic and catches the bloom pass.
 *
 * Two modes:
 *   • default — parked just above the sun inside the 3D scene, dimming as the
 *     coloured scene reveals.
 *   • `ui`    — centred on the origin for a small embedded HUD canvas, spinning
 *     a little faster and held at full brightness.
 */
export default function WireShip({ ui = false }) {
  const groupRef = useRef(null)
  const matRef = useRef(null)

  const hullGeometry = useMemo(() => {
    const seg = [] // flat [x,y,z, x,y,z, ...] pairs for lineSegments
    const line = (a, b) => seg.push(a[0], a[1], a[2], b[0], b[1], b[2])

    /* ---- Fuselage: stacked elliptical cross-sections from nose to tail. ---- */
    const SEG = 10
    // [z, rx, ry, cy] — radius (x/y) and vertical centre at each station.
    const stations = [
      [-3.10, 0.06, 0.05, 0.04],
      [-2.70, 0.24, 0.20, 0.03],
      [-2.00, 0.44, 0.37, 0.0],
      [-1.10, 0.60, 0.50, -0.02],
      [-0.10, 0.68, 0.56, -0.03],
      [0.90, 0.70, 0.58, -0.03],
      [1.80, 0.67, 0.55, -0.02],
      [2.50, 0.60, 0.50, 0.0],
      [3.00, 0.52, 0.46, 0.02],
    ]

    const rings = stations.map(([z, rx, ry, cy]) => {
      const pts = []
      for (let i = 0; i < SEG; i++) {
        const a = (i / SEG) * Math.PI * 2
        pts.push([Math.cos(a) * rx, cy + Math.sin(a) * ry, z])
      }
      return pts
    })

    // Cross-section rings + longitudinal stringers between them.
    for (const ring of rings) {
      for (let i = 0; i < SEG; i++) line(ring[i], ring[(i + 1) % SEG])
    }
    for (let k = 0; k < rings.length - 1; k++) {
      for (let i = 0; i < SEG; i++) line(rings[k][i], rings[k + 1][i])
    }

    // Pointed nose: converge the front ring to a tip.
    const nose = [0, 0.04, -3.45]
    for (const p of rings[0]) line(nose, p)

    /* ---- Double-delta wings (right side, then mirrored). ---- */
    const yW = -0.16
    const wing = [
      [0.45, yW, -0.55], // forward apex against the fuselage
      [1.25, yW, 0.55], // leading-edge kink (double delta)
      [3.05, yW, 2.05], // tip leading
      [3.05, yW, 2.7], // tip trailing
      [0.55, yW, 3.0], // inner trailing
    ]
    const drawWing = (sx) => {
      const w = wing.map(([x, y, z]) => [x * sx, y, z])
      for (let i = 0; i < w.length; i++) line(w[i], w[(i + 1) % w.length])
      // Internal panel + elevon hinge lines for a built-up look.
      line(w[1], w[4])
      line(lerp3(w[1], w[2], 0.5), lerp3(w[4], w[3], 0.5))
      const hingeF = lerp3(w[4], w[3], 0.0)
      const hingeT = lerp3(w[3], w[2], 0.0)
      line(lerp3(hingeF, w[0], 0.0), hingeT)
    }
    drawWing(1)
    drawWing(-1)

    /* ---- Vertical tail fin (swept), in the X=0 plane. ---- */
    const fin = [
      [0, 0.5, 1.85], // base front
      [0, 0.5, 3.0], // base back
      [0, 1.75, 2.92], // tip back
      [0, 1.55, 2.45], // tip front (swept)
    ]
    for (let i = 0; i < fin.length; i++) line(fin[i], fin[(i + 1) % fin.length])
    // Rudder hinge.
    line(lerp3(fin[0], fin[1], 0.62), lerp3(fin[3], fin[2], 0.62))
    line(lerp3(fin[0], fin[3], 0.5), lerp3(fin[1], fin[2], 0.5))

    /* ---- Engine cylinders / nozzles. ---- */
    const addCyl = (cx, cy, cz, r, len, segs, taper = 1) => {
      const zB = cz + len
      let p0 = null
      let p1 = null
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2
        const cos = Math.cos(a)
        const sin = Math.sin(a)
        const q0 = [cx + cos * r, cy + sin * r, cz]
        const q1 = [cx + cos * r * taper, cy + sin * r * taper, zB]
        if (i > 0) {
          line(p0, q0)
          line(p1, q1)
        }
        if (i % 3 === 0) line(q0, q1)
        p0 = q0
        p1 = q1
      }
    }

    // Three main engines (SSME cluster) flaring out of the tail.
    addCyl(0, 0.34, 3.0, 0.17, 0.42, 12, 1.5)
    addCyl(-0.24, -0.02, 3.0, 0.16, 0.4, 12, 1.5)
    addCyl(0.24, -0.02, 3.0, 0.16, 0.4, 12, 1.5)

    // Two OMS pods flanking the tail base, pointing aft.
    addCyl(-0.34, 0.42, 2.45, 0.15, 0.55, 10, 0.6)
    addCyl(0.34, 0.42, 2.45, 0.15, 0.55, 10, 0.6)

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3))
    return geo
  }, [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const t = state.clock.elapsedTime

    if (ui) {
      // Compact HUD instrument: hover gently in place, spin a touch faster so
      // the orbiter silhouette reads clearly in the small viewport.
      group.position.y = Math.sin(t * 0.6) * 0.12
      group.rotation.y = t * 0.3
      group.rotation.z = Math.sin(t * 0.5) * 0.06
      if (matRef.current) matRef.current.opacity = 0.9
      return
    }

    group.position.y = HOVER + Math.sin(t * 0.5) * 0.35
    group.rotation.y = t * 0.12
    group.rotation.z = Math.sin(t * 0.4) * 0.05

    // Brightest in the wireframe overview; dims a little as the coloured scene
    // reveals so it never overpowers the planets.
    if (matRef.current) {
      const reveal = revealFactor(useStore.getState().progress)
      matRef.current.opacity = 0.85 - reveal * 0.4
    }
  })

  return (
    <group
      ref={groupRef}
      position={[0, ui ? 0 : HOVER, 0]}
      rotation={[ui ? -0.42 : -0.07, 0, 0]}
      frustumCulled={false}
    >
      <lineSegments geometry={hullGeometry} frustumCulled={false}>
        <lineBasicMaterial
          ref={matRef}
          color={LINE}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}
