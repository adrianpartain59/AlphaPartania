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

/**
 * Scroll progress at which the opening "fly through the bottom-right HUD"
 * sequence ends. Over [0, PASSTHROUGH_END] the camera slides the solar system
 * to screen centre and dollies in while the HUD frame scales up and passes the
 * camera; the detail reveal and planet journey only begin afterwards.
 */
export const PASSTHROUGH_END = 0.1

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

  /**
   * Wireframe → full-detail reveal window (in scroll progress). The detail
   * reveal is held off until the camera has "passed through" the bottom-right
   * HUD (see PASSTHROUGH_END) — during the fly-through the system keeps its bare
   * wireframe look, then crossfades into the full coloured scene as the camera
   * closes on the first planet.
   */
  reveal: { start: PASSTHROUGH_END + 0.005, end: 0.28 },

  camera: {
    fov: 50,
    /**
     * Establishing shot (progress = 0). Pulled way back and shifted left of the
     * system so the whole solar system reads small and sits on the right half of
     * the screen, opposite the intro copy in the top-left.
     */
    overview: { position: [0, 95, 200], target: [-96, 45, 0] },
    /**
     * End of the HUD fly-through (progress = PASSTHROUGH_END). The system has
     * slid to screen centre and the camera has dollied a little closer, but it
     * still reads as the top-down wireframe overview (reveal is still 0).
     */
    centered: { position: [0, 78, 150], target: [0, 22, 0] },
    /** Pulled-back closing shot (progress = 1) for the outro. */
    wide: { position: [4, 66, 66], target: [0, 0, -6] },
    /** How a per-planet focus keyframe is derived from the planet position. */
    focus: { distance: 8.5, height: 3.6 },
  },
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Detail-reveal factor for a given scroll progress: 0 at the establishing shot
 * (wireframe: white lines + outlined spheres, no colour/dust) easing to 1 as the
 * camera closes in (full coloured scene). Smoothstepped so the crossfade is
 * gentle at both ends.
 */
export function revealFactor(progress) {
  const { start, end } = sceneConfig.reveal
  const t = Math.max(0, Math.min(1, (progress - start) / (end - start)))
  return t * t * (3 - 2 * t)
}

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
  { progress: PASSTHROUGH_END, type: 'static', ...sceneConfig.camera.centered },
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
