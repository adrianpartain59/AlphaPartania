import { useEffect } from 'react'
import { useStore } from '../store/useStore'
import * as audio from '../audio/audio'

/**
 * Bridges the store and DOM gestures into the audio engine:
 *   • preloads the SFX,
 *   • mirrors `ready` and `muted` into the engine (only on change),
 *   • listens for the first user gesture to satisfy browser autoplay rules.
 * Together these guarantee the music only starts once everything is loaded
 * AND the user has interacted.
 */
export function useAudio() {
  useEffect(() => {
    audio.loadSfx()

    const initial = useStore.getState()
    let prevReady = initial.ready
    let prevMuted = initial.muted
    audio.setReady(prevReady)
    audio.setMuted(prevMuted)

    const unsub = useStore.subscribe((s) => {
      if (s.ready !== prevReady) {
        prevReady = s.ready
        audio.setReady(s.ready)
      }
      if (s.muted !== prevMuted) {
        prevMuted = s.muted
        audio.setMuted(s.muted)
      }
    })

    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    const onGesture = () => {
      audio.markInteracted()
      if (audio.isMusicStarted()) removeGestureListeners()
    }
    const removeGestureListeners = () =>
      events.forEach((e) => window.removeEventListener(e, onGesture))
    events.forEach((e) =>
      window.addEventListener(e, onGesture, { passive: true }),
    )

    return () => {
      unsub()
      removeGestureListeners()
    }
  }, [])
}
