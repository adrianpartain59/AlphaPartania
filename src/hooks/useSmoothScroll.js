import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore } from '../store/useStore'

gsap.registerPlugin(ScrollTrigger)

/**
 * Sets up buttery DOM scrolling with Lenis and tracks overall scroll progress
 * with a single GSAP ScrollTrigger. The progress (0→1) is pushed into the
 * store, where it drives both the camera's Z travel and the overlay fades.
 *
 * Lenis and GSAP are deliberately married through GSAP's ticker (rather than
 * each running their own RAF loop) so scroll, ScrollTrigger and the R3F render
 * loop all advance on the same clock — no jitter, no double rAF.
 */
export function useSmoothScroll() {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches

    const lenis = new Lenis({
      duration: 1.15,
      // Gentle exponential easing for a premium, weighty feel.
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: !prefersReducedMotion,
      syncTouch: false,
      touchMultiplier: 1.5,
    })

    // Expose the instance so UI controls can smooth-scroll to a section.
    useStore.getState().setLenis(lenis)
    // Dev-only handle for debugging / automated checks in the console.
    if (import.meta.env.DEV) window.__lenis = lenis

    // Keep ScrollTrigger in lock-step with Lenis.
    lenis.on('scroll', ScrollTrigger.update)

    // Drive Lenis from GSAP's ticker instead of its own requestAnimationFrame.
    const onTick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(onTick)
    gsap.ticker.lagSmoothing(0)

    const setProgress = useStore.getState().setProgress

    // One trigger spanning the whole document → normalised 0→1 progress.
    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => setProgress(self.progress),
    })

    // Fonts / images can shift layout; recalc once everything settles.
    const refresh = () => ScrollTrigger.refresh()
    const refreshTimer = window.setTimeout(refresh, 250)
    window.addEventListener('load', refresh)

    return () => {
      window.clearTimeout(refreshTimer)
      window.removeEventListener('load', refresh)
      trigger.kill()
      gsap.ticker.remove(onTick)
      lenis.destroy()
      useStore.getState().setLenis(null)
    }
  }, [])
}
