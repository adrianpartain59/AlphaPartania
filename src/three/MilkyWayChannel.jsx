import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

/* ------------------------------ tuning ----------------------------------- */
const COUNT = 11000
const Z_LEFT = -270
const Z_RIGHT = -560
const Z_INTERACTION = (Z_LEFT + Z_RIGHT) / 2
const Y_OFFSET = -95
const X_MIN = -700
const X_MAX = 2500
const CHANNEL_WIDTH = 175
const CHANNEL_SLOPE = 0.075
const CONTAINER_HALF_WIDTH = 430
const MAX_FOLLOW = 120
const FLOW_SPEED = 38

// Soft mouse interaction in world units on the background channel plane.
const INFLUENCE = 295
const STRENGTH = 280
const SPRING = 3.6
const DAMP = 4.8
const MAX_DELTA = 0.05

function useSpriteTexture() {
  return useMemo(() => {
    const s = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = s
    const ctx = canvas.getContext('2d')

    // Bubble-like sprite: translucent body with a crisp glowing rim.
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,0.2)')
    g.addColorStop(0.45, 'rgba(190,230,255,0.14)')
    g.addColorStop(0.72, 'rgba(210,240,255,0.08)')
    g.addColorStop(0.82, 'rgba(255,255,255,0.82)')
    g.addColorStop(0.9, 'rgba(180,225,255,0.34)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, s, s)

    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.39, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(255,255,255,0.72)'
    ctx.lineWidth = 2.5
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(s * 0.38, s * 0.34, s * 0.08, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.42)'
    ctx.fill()

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }, [])
}

const gaussian = () =>
  (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2

function channelCenter(x, t, seed) {
  return (
    Y_OFFSET +
    x * CHANNEL_SLOPE +
    Math.sin(x * 0.035 + t * 0.35 + seed) * 10 +
    Math.sin(x * 0.08 - t * 0.18 + seed * 0.7) * 3.5
  )
}

function channelDepth(x, t, seed) {
  const u = THREE.MathUtils.clamp((x - X_MIN) / (X_MAX - X_MIN), 0, 1)
  return (
    THREE.MathUtils.lerp(Z_LEFT, Z_RIGHT, u) +
    Math.sin(u * Math.PI + t * 0.12 + seed) * 18
  )
}

/**
 * A distant world-space particle river. It sits behind the solar system on a
 * real 3D plane, so planets/sun can render in front while the pointer still
 * interacts with the channel via raycasting.
 */
export default function MilkyWayChannel() {
  const pointsRef = useRef(null)
  const sprite = useSpriteTexture()

  const data = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const x = new Float32Array(COUNT)
    const yOff = new Float32Array(COUNT)
    const zOff = new Float32Array(COUNT)
    const speed = new Float32Array(COUNT)
    const seed = new Float32Array(COUNT)
    const disp = new Float32Array(COUNT * 2)
    const vel = new Float32Array(COUNT * 2)
    const color = new THREE.Color()

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const edge = Math.abs(gaussian())

      x[i] = THREE.MathUtils.lerp(X_MIN, X_MAX, Math.random())
      yOff[i] = gaussian() * CHANNEL_WIDTH * (0.5 + edge)
      zOff[i] = gaussian() * 12
      speed[i] = FLOW_SPEED * (0.55 + Math.random() * 0.9)
      seed[i] = Math.random() * Math.PI * 2

      const homeY = channelCenter(x[i], 0, seed[i]) + yOff[i]
      positions[ix] = x[i]
      positions[ix + 1] = homeY
      positions[ix + 2] = channelDepth(x[i], 0, seed[i]) + zOff[i]

      const roll = Math.random()
      if (roll > 0.92) color.setHSL(0.74, 0.45, 0.72) // faint violet glints
      else if (roll > 0.66) color.setHSL(0.55, 0.38, 0.78) // cold blue-white
      else color.setHSL(0.58, 0.24, 0.55 + Math.random() * 0.18)

      // Dim the outer haze so the dense core reads as the channel.
      const brightness = THREE.MathUtils.clamp(1.1 - edge * 0.42, 0.42, 1)
      colors[ix] = color.r * brightness
      colors[ix + 1] = color.g * brightness
      colors[ix + 2] = color.b * brightness
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    return { geometry, positions, x, yOff, zOff, speed, seed, disp, vel }
  }, [])

  const mem = useMemo(
    () => ({
      plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_INTERACTION),
      hit: new THREE.Vector3(),
    }),
    [],
  )

  useFrame((state, rawDelta) => {
    const points = pointsRef.current
    if (!points) return

    const delta = Math.min(rawDelta, MAX_DELTA)
    const t = state.clock.elapsedTime
    const { camera, pointer, raycaster } = state
    const { positions, x, yOff, zOff, speed, seed, disp, vel } = data

    raycaster.setFromCamera(pointer, camera)
    const hasHit = !!raycaster.ray.intersectPlane(mem.plane, mem.hit)
    const pointerCenter = channelCenter(mem.hit.x, t, 0)
    const pointerInChannel =
      hasHit &&
      mem.hit.x >= X_MIN &&
      mem.hit.x <= X_MAX &&
      Math.abs(mem.hit.y - pointerCenter) <= CONTAINER_HALF_WIDTH
    const infl2 = INFLUENCE * INFLUENCE
    const maxFollow2 = MAX_FOLLOW * MAX_FOLLOW

    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3
      const i2 = i * 2

      x[i] += speed[i] * delta
      if (x[i] > X_MAX) {
        x[i] = X_MIN
        disp[i2] = 0
        disp[i2 + 1] = 0
        vel[i2] = 0
        vel[i2 + 1] = 0
      }

      const wave = Math.sin(t * 0.22 + seed[i]) * 1.6
      const bx = x[i]
      const by = channelCenter(bx, t, seed[i]) + yOff[i] + wave

      let dx = disp[i2]
      let dy = disp[i2 + 1]
      let vx = vel[i2]
      let vy = vel[i2 + 1]

      const rx = mem.hit.x - (bx + dx)
      const ry = mem.hit.y - (by + dy)
      const d2 = rx * rx + ry * ry
      if (pointerInChannel && d2 < infl2) {
        const d = Math.sqrt(d2) || 0.0001
        const f = 1 - d / INFLUENCE
        const force = f * f * STRENGTH
        vx += (rx / d) * force * delta
        vy += (ry / d) * force * delta
      }

      vx += (-SPRING * dx - DAMP * vx) * delta
      vy += (-SPRING * dy - DAMP * vy) * delta
      dx += vx * delta
      dy += vy * delta

      const disp2 = dx * dx + dy * dy
      if (disp2 > maxFollow2) {
        const limit = MAX_FOLLOW / Math.sqrt(disp2)
        dx *= limit
        dy *= limit
        vx *= 0.65
        vy *= 0.65
      }

      disp[i2] = dx
      disp[i2 + 1] = dy
      vel[i2] = vx
      vel[i2 + 1] = vy

      positions[ix] = bx + dx
      positions[ix + 1] = by + dy
      positions[ix + 2] = channelDepth(bx, t, seed[i]) + zOff[i]
    }

    points.geometry.attributes.position.needsUpdate = true
  })

  return (
    <group renderOrder={-20}>
      <points ref={pointsRef} geometry={data.geometry} frustumCulled={false}>
        <pointsMaterial
          map={sprite}
          size={2.35}
          sizeAttenuation
          vertexColors
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          opacity={0.58}
        />
      </points>
    </group>
  )
}
