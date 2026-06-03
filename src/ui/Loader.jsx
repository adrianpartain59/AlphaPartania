import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'

/**
 * Terminal-style boot curtain that hides the initial shader compile, then fades
 * out once the scene reports its first frames. Removed after the fade so it
 * never blocks pointer events.
 */
export default function Loader() {
  const ready = useStore((s) => s.ready)
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!ready) return
    const t = window.setTimeout(() => setRemoved(true), 800)
    return () => window.clearTimeout(t)
  }, [ready])

  if (removed) return null

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-void)]',
        'transition-opacity duration-700 ease-out',
        ready ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <span className="absolute left-6 top-6 h-6 w-6 border-l-2 border-t-2 border-[var(--color-hud)]/60" />
      <span className="absolute right-6 top-6 h-6 w-6 border-r-2 border-t-2 border-[var(--color-hud)]/60" />
      <span className="absolute bottom-6 left-6 h-6 w-6 border-b-2 border-l-2 border-[var(--color-hud)]/60" />
      <span className="absolute bottom-6 right-6 h-6 w-6 border-b-2 border-r-2 border-[var(--color-hud)]/60" />

      <p className="text-2xl font-700 tracking-[0.25em] text-[var(--color-ice)]">
        ALPHA<span className="text-[var(--color-hud)]">PARTANIA</span>
      </p>
      <p className="mt-3 text-[10px] tracking-[0.4em] text-[var(--color-hud)]/60">
        INITIALISING ORBITAL SYSTEMS
      </p>
      <div className="relative mt-6 h-px w-48 overflow-hidden bg-[var(--color-hud)]/15">
        <div className="animate-loading-slide absolute inset-y-0 left-0 w-1/3 bg-[var(--color-hud)]" />
      </div>
    </div>
  )
}
