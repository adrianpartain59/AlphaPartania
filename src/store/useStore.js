import { create } from 'zustand'

/**
 * A deliberately tiny store. Its only job is to be the bridge between two
 * worlds that can't share React state directly:
 *
 *   • the R3F render loop (reads `progress` transiently via `getState()` inside
 *     `useFrame`, so it never triggers React re-renders), and
 *   • the HTML overlay (subscribes to `progress` so panels can fade in/out).
 *
 * Keeping it here means the scroll handler writes once and both consumers stay
 * perfectly in sync.
 */
export const useStore = create((set) => ({
  /** Normalised scroll progress, 0 (top) → 1 (bottom). */
  progress: 0,
  /** True once the WebGL scene has loaded its first frame. */
  ready: false,
  /** True the moment the user scrolls — used to retire the hero scroll cue. */
  hasScrolled: false,
  /** The live Lenis instance, so UI (e.g. nav dots) can smooth-scroll. */
  lenis: null,
  /** Global audio mute toggle (music + SFX). */
  muted: false,
  /** True once the "click to enable sound" prompt has been dismissed. */
  soundPromptDone: false,

  setProgress: (progress) =>
    set((state) =>
      state.hasScrolled || progress <= 0.0001
        ? { progress }
        : { progress, hasScrolled: true },
    ),

  setReady: (ready) => set({ ready }),
  setSoundPromptDone: (soundPromptDone) => set({ soundPromptDone }),
  setLenis: (lenis) => set({ lenis }),
  setMuted: (muted) => set({ muted }),
  toggleMuted: () => set((s) => ({ muted: !s.muted })),
}))
