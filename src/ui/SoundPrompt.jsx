import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

/**
 * A brief, flashing "click to enable sound" prompt shown over everything else
 * on first load. It nudges the user to interact (which satisfies the browser's
 * autoplay gate so the music can start) and then gets out of the way.
 *
 * Dismisses on the first pointer/key interaction, or automatically after 4s.
 */
export default function SoundPrompt() {
  const loadingDone = useStore((s) => s.loadingDone)
  const [visible, setVisible] = useState(true)
  const setSoundPromptDone = useStore((s) => s.setSoundPromptDone)

  useEffect(() => {
    // Hold off entirely until the loading animation has finished, so the prompt
    // (and its auto-dismiss timer) only kicks in once the loader is gone.
    if (!loadingDone) return

    const dismiss = () => {
      setVisible(false)
      setSoundPromptDone(true)
    }

    const timer = window.setTimeout(dismiss, 4000)
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel']
    events.forEach((e) => window.addEventListener(e, dismiss, { passive: true, once: true }))

    return () => {
      window.clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, dismiss))
    }
  }, [loadingDone, setSoundPromptDone])

  if (!loadingDone) return null

  return (
    <div
      aria-hidden={!visible}
      className={[
        'fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-[3px]',
        'transition-opacity duration-500 ease-out',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      ].join(' ')}
    >
      <p className="animate-pulse-soft flex items-center gap-3 text-[11px] tracking-[0.45em] text-[var(--color-hud)] md:text-sm">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M4 9v6h4l5 4V5L8 9H4z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        CLICK ANYWHERE TO ENABLE SOUND
      </p>
    </div>
  )
}
