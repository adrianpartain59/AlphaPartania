import gsap from 'gsap'
import { useStore } from '../store/useStore'

/**
 * Scroll-scrubbed GSAP timeline for the opening HUD pass-through.
 * Intensity is 0 at the start, peaks at the midpoint of camera Z travel, then
 * eases back to 0 when the camera reaches the centered overview.
 *
 * Writes into `intensityRef` (mutated each scrub); apply to the shader in useFrame.
 *
 * @param {{ value: number }} intensityRef — shared driver, read every frame
 */
// Absolute scroll-progress window over which the refraction plays. The bubble
// is dead outside [BUBBLE_START, BUBBLE_END]; it swells up then eases back to 0
// across this span. Slide both bounds together to move the effect earlier/later
// without changing its length; widen the gap to make it last longer.
const BUBBLE_START = 0.03
const BUBBLE_END = 0.168

export function attachBubbleDistortionTimeline(intensityRef) {
  const tl = gsap.timeline({ paused: true })
  // Swell up to peak refraction as the UI pane sweeps past and the camera
  // punches through — drawn out so it lingers rather than flashing.
  tl.to(intensityRef, {
    value: 2.8,
    duration: 0.478,
    ease: 'power2.in',
  })
  // …then ease back down to 0 over a long tail as the camera settles inside.
  tl.to(intensityRef, {
    value: 0,
    duration: 0.522,
    ease: 'power2.inOut',
  })

  const scrub = (progress) => {
    const band = Math.min(
      1,
      Math.max(0, (progress - BUBBLE_START) / (BUBBLE_END - BUBBLE_START)),
    )
    tl.progress(band)
  }

  scrub(useStore.getState().progress)
  const unsub = useStore.subscribe((state) => scrub(state.progress))

  return () => {
    unsub()
    tl.kill()
  }
}
