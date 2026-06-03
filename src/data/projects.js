/**
 * Single source of truth for the portfolio.
 *
 * The scene is a stylised solar system viewed (initially) from the top: a blue
 * sun at the origin with each project orbiting it on the XZ plane. The camera
 * starts zoomed out over the whole system, then travels in to visit each
 * planet in turn. Every derived value — orbit positions, camera keyframes,
 * overlay focus timing — flows from this file so the 3D scene and the HUD stay
 * in lock-step.
 */
export const projects = [
  {
    id: 1,
    name: 'Pep AI',
    description: 'Metrics & Tracking Dashboard',
    // Orbit (XZ plane). Inner planets orbit a touch faster.
    orbitRadius: 15,
    orbitAngle: 0.6, // initial angle (radians)
    orbitY: 0,
    orbitSpeed: 0.05,
    // Scroll progress at which the camera settles on this planet.
    focusProgress: 0.27,
    accent: '#b026ff',
    side: 'left', // which side its HUD panel anchors to
    tagline: 'Real-time analytics for teams that move fast.',
    stack: ['React', 'D3', 'WebSockets'],
    year: '2025',
  },
  {
    id: 2,
    name: 'Algol Run',
    description: 'Infinite Runner Game',
    orbitRadius: 26,
    orbitAngle: 2.6,
    orbitY: 2,
    orbitSpeed: 0.035,
    focusProgress: 0.52,
    accent: '#d65cff',
    side: 'right',
    tagline: 'A neon endless runner pushed to 60fps on the web.',
    stack: ['TypeScript', 'Canvas', 'Howler'],
    year: '2024',
  },
  {
    id: 3,
    name: 'Fasto',
    description: 'Web Landing Page',
    orbitRadius: 38,
    orbitAngle: 4.5,
    orbitY: -2,
    orbitSpeed: 0.022,
    focusProgress: 0.78,
    accent: '#8a5cff',
    side: 'left',
    tagline: 'A conversion-focused landing experience.',
    stack: ['Next.js', 'GSAP', 'Tailwind'],
    year: '2024',
  },
]

/* -------------------------------------------------------------------------- */
/*  Scene configuration                                                       */
/* -------------------------------------------------------------------------- */
export const sceneConfig = {
  background: '#060a12',

  sun: {
    radius: 4.6,
    color: '#2f9dff',
    coronaColor: '#7fc8ff',
  },

  planet: {
    /** Outer gyroscope ring radius. */
    gyroRadius: 3.0,
    /** Refractive glass core radius. */
    coreRadius: 1.55,
  },

  camera: {
    fov: 50,
    /** Zoomed-out, top-down establishing shot (progress = 0). */
    overview: { position: [0, 84, 30], target: [0, 0, 0] },
    /** Pulled-back closing shot (progress = 1) for the outro. */
    wide: { position: [4, 66, 66], target: [0, 0, -6] },
    /** How a per-planet focus keyframe is derived from the planet position. */
    focus: { distance: 8.5, height: 3.6 },
  },
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/** World-space position of a planet at time `t` (seconds). */
export function planetOrbitPosition(project, t, out = [0, 0, 0]) {
  const a = project.orbitAngle + t * project.orbitSpeed
  out[0] = Math.cos(a) * project.orbitRadius
  out[1] = project.orbitY
  out[2] = Math.sin(a) * project.orbitRadius
  return out
}

/**
 * Ordered camera keyframes by scroll progress. Planet keyframes are flagged so
 * the rig can resolve their live (orbiting) positions every frame; overview /
 * wide are static.
 */
export const cameraStops = [
  { progress: 0, type: 'static', ...sceneConfig.camera.overview },
  ...projects.map((p) => ({
    progress: p.focusProgress,
    type: 'planet',
    projectId: p.id,
  })),
  { progress: 1, type: 'static', ...sceneConfig.camera.wide },
]

/** Overlay focus markers (id + progress) — same numbers that drive the camera. */
export const focusMarkers = projects.map((p) => ({
  id: p.id,
  progress: p.focusProgress,
}))
