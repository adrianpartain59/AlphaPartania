import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import {
  cameraStops,
  projects,
  planetOrbitPosition,
  sceneConfig,
} from '../data/projects'

/* ------------------------------ tuning ----------------------------------- */
const MOVE_LAMBDA = 4.5 // damping for camera position
const LOOK_LAMBDA = 5 // damping for the look-at target
const PARALLAX = 0.035 // parallax offset as a fraction of view distance
const WORLD_UP = new THREE.Vector3(0, 1, 0)

const clamp01 = (v) => Math.max(0, Math.min(1, v))
const smooth = (t) => t * t * (3 - 2 * t)

/**
 * Owns the camera. Each frame it:
 *
 *   1. Resolves every keyframe to a concrete position + target. Planet stops
 *      track the planet's *live* orbit position so the framing is always exact.
 *   2. Finds the segment the scroll progress falls in and eases between the two
 *      surrounding keyframes → a glide-and-settle journey from the zoomed-out
 *      top-down overview, in to each planet, then back out for the outro.
 *   3. Adds a subtle, target-preserving mouse parallax (scaled by how far away
 *      the camera is, so it reads at every zoom level).
 *   4. Damps toward the result for frame-rate-independent smoothness.
 */
export default function CameraRig() {
  const camera = useThree((s) => s.camera)

  const byId = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [],
  )

  // Pre-allocate everything the frame loop touches.
  const mem = useMemo(() => {
    const stops = cameraStops.map((s) => ({
      progress: s.progress,
      type: s.type,
      project: s.type === 'planet' ? byId[s.projectId] : null,
      staticPos: s.position ? new THREE.Vector3(...s.position) : null,
      staticTarget: s.target ? new THREE.Vector3(...s.target) : null,
      pos: new THREE.Vector3(),
      target: new THREE.Vector3(),
    }))
    return {
      stops,
      lookAt: new THREE.Vector3(...sceneConfig.camera.overview.target),
      desiredPos: new THREE.Vector3(),
      desiredTarget: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      right: new THREE.Vector3(),
      up: new THREE.Vector3(),
      orbit: [0, 0, 0],
    }
  }, [byId])

  useFrame((state, delta) => {
    const { progress } = useStore.getState()
    const t = state.clock.elapsedTime
    const { stops } = mem
    const { distance, height } = sceneConfig.camera.focus

    // 1 · Resolve each keyframe.
    for (const stop of stops) {
      if (stop.type === 'planet') {
        const o = planetOrbitPosition(stop.project, t, mem.orbit)
        stop.target.set(o[0], o[1], o[2])
        // Sit outside the orbit (radially) and a touch above, looking inward.
        const radial = Math.hypot(o[0], o[2]) || 1
        stop.pos.set(
          o[0] + (o[0] / radial) * distance,
          o[1] + height,
          o[2] + (o[2] / radial) * distance,
        )
      } else {
        stop.pos.copy(stop.staticPos)
        stop.target.copy(stop.staticTarget)
      }
    }

    // 2 · Find the active segment and ease between its keyframes.
    let i = 0
    while (i < stops.length - 2 && progress > stops[i + 1].progress) i++
    const a = stops[i]
    const b = stops[i + 1]
    const span = b.progress - a.progress || 1
    const e = smooth(clamp01((progress - a.progress) / span))

    mem.desiredPos.copy(a.pos).lerp(b.pos, e)
    mem.desiredTarget.copy(a.target).lerp(b.target, e)

    // 3 · Target-preserving parallax.
    mem.dir.copy(mem.desiredTarget).sub(mem.desiredPos)
    const viewDist = mem.dir.length() || 1
    mem.dir.divideScalar(viewDist)
    mem.right.crossVectors(mem.dir, WORLD_UP)
    if (mem.right.lengthSq() < 1e-4) mem.right.set(1, 0, 0) // looking straight down
    mem.right.normalize()
    mem.up.crossVectors(mem.right, mem.dir).normalize()
    const amp = viewDist * PARALLAX
    mem.desiredPos.addScaledVector(mem.right, state.pointer.x * amp)
    mem.desiredPos.addScaledVector(mem.up, state.pointer.y * amp)

    // 4 · Damp toward the result.
    const kp = 1 - Math.exp(-MOVE_LAMBDA * delta)
    const kl = 1 - Math.exp(-LOOK_LAMBDA * delta)
    camera.position.lerp(mem.desiredPos, kp)
    mem.lookAt.lerp(mem.desiredTarget, kl)
    camera.lookAt(mem.lookAt)
  })

  return null
}
