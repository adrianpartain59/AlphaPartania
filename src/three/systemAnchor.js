/**
 * Bridge between the WebGL camera and the HTML overlay.
 *
 * `<SystemAnchor>` (inside the <Canvas>) projects the solar-system centre
 * (world origin) to screen pixels every frame and records the camera's distance
 * to it. The Overlay's own rAF loop reads this to pin the bottom-right HUD frame
 * to the live 3D system so the two stay perfectly locked while the camera flies
 * through during the opening pass-through.
 *
 * It is a plain module-level mutable (not React state) so updates never trigger
 * re-renders — both writer and reader poll it on their own animation frames.
 */
export const systemAnchor = {
  /** Screen-space x of the system centre, in CSS pixels. */
  x: 0,
  /** Screen-space y of the system centre, in CSS pixels. */
  y: 0,
  /** Live camera distance to the system centre. */
  dist: 1,
  /** Distance captured on the first frame (the resting overview distance). */
  dist0: 0,
  /** True once at least one frame has populated the values above. */
  ready: false,
}
