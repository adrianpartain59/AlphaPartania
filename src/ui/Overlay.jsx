import { useEffect, useMemo, useRef, useState } from 'react'
import { projects, focusMarkers } from '../data/projects'
import { useStore } from '../store/useStore'
import { playSfx, playTypingSfx, stopTypingSfx, getMusicLevels } from '../audio/audio'
import ScreenFrame from './ScreenFrame'
import SystemHud, { WireGlobe } from './SystemHud'
import HudButton from './HudButton'
import HudFrame from './HudFrame'

/* ----------------------------- math helpers ------------------------------ */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}
const PANEL_FULL = 0.05
const PANEL_FADE = 0.14

/* HUD bounding box framing the system (bottom-right) on the landing shot.
   Lines + chamfer match the outer ScreenFrame perimeter. */
const SYS_LINE = 'rgba(255,255,255,0.9)'
const SYS_CHAMFER = 22
const SYS_DIAG = SYS_CHAMFER * Math.SQRT2
/* Where, along the top edge, the trapezoidal tab chamfers up and out. */
const SYS_TAB_AT = '40%'

// Ordered waypoints the prev/next buttons step through:
// overview → each project → outro.
const WAYPOINTS = [0, ...focusMarkers.map((m) => m.progress), 1]

/** Longest hero typewriter run ends ~2.2s after `soundPromptDone`. */
const HERO_TYPING_MS = 2400

/**
 * Types `text` out character-by-character once `on` is true. Words stay
 * unbroken for wrapping; spaces remain in the flow.
 */
function TypewriterReveal({ text, on, start = 0, stagger = 0.018, className }) {
  const tokens = useMemo(() => text.split(/(\s+)/), [text])
  const charCount = useMemo(() => {
    let n = 0
    for (const token of tokens) n += token.length
    return n
  }, [tokens])

  const [visible, setVisible] = useState(0)

  useEffect(() => {
    if (!on) {
      setVisible(0)
      return
    }
    setVisible(0)
    let interval
    const timeout = window.setTimeout(() => {
      let i = 0
      interval = window.setInterval(() => {
        i += 1
        setVisible(i)
        if (i >= charCount && interval) window.clearInterval(interval)
      }, stagger * 1000)
    }, start * 1000)
    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [on, start, stagger, charCount])

  let index = 0
  return (
    <span className={className}>
      {tokens.map((token, ti) => {
        const isSpace = /^\s+$/.test(token)
        if (isSpace) {
          const chars = [...token]
          return (
            <span key={ti} className="whitespace-pre">
              {chars.map((ch) => {
                const i = index++
                return (
                  <span key={i} className={i < visible ? '' : 'invisible'}>
                    {ch}
                  </span>
                )
              })}
            </span>
          )
        }
        return (
          <span key={ti} className="inline-block whitespace-nowrap">
            {[...token].map((ch) => {
              const i = index++
              return (
                <span key={i} className={i < visible ? '' : 'invisible'}>
                  {ch}
                </span>
              )
            })}
          </span>
        )
      })}
    </span>
  )
}

/** Number of bands in the audio equalizer (low / mid / high). */
const EQ_BANDS = 3

/**
 * Sci-fi audio equalizer driven by the live music spectrum. When the track is
 * silent (muted / not yet started) the bars rest at zero and it reads AUDIO OFF.
 * Reads levels in its own rAF and writes straight to the DOM (no re-renders).
 */
function AudioMeter() {
  const barRefs = useRef([])
  const statusRef = useRef(null)
  const playingRef = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const levels = getMusicLevels(EQ_BANDS)
      const on = !!levels
      if (on !== playingRef.current) {
        playingRef.current = on
        if (statusRef.current) statusRef.current.textContent = on ? 'AUDIO' : 'AUDIO OFF'
      }
      for (let i = 0; i < EQ_BANDS; i++) {
        const el = barRefs.current[i]
        if (el) el.style.transform = `scaleY(${0.07 + (levels ? levels[i] : 0) * 0.93})`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex h-40 items-end gap-3 md:h-44">
        {Array.from({ length: EQ_BANDS }).map((_, i) => (
          <span
            key={i}
            ref={(el) => (barRefs.current[i] = el)}
            className="w-[10px] bg-white/80 md:w-[11px]"
            style={{ height: '100%', transformOrigin: 'bottom', transform: 'scaleY(0.06)', transition: 'transform 0.07s linear' }}
          />
        ))}
      </div>
      <span
        ref={statusRef}
        className="whitespace-nowrap text-right text-[8px] tracking-[0.3em] text-white/40 md:text-[9px]"
      >
        AUDIO OFF
      </span>
    </div>
  )
}

/**
 * The 2D terminal layer above the WebGL canvas.
 *
 * It never re-renders on scroll: it subscribes to the store once and writes
 * opacity/transform straight to the DOM via refs. Project read-outs (each
 * wrapped in a HUD frame) fade in as the camera settles on their planet; the
 * hero retreats once travel begins; the outro arrives as the camera pulls back
 * out over the system.
 *
 * The wrapper is `pointer-events-none` so the cursor still reaches the canvas
 * (parallax + gas-like dust repulsion); only interactive bits opt back in.
 */
export default function Overlay() {
  const muted = useStore((s) => s.muted)
  const toggleMuted = useStore((s) => s.toggleMuted)
  const heroReady = useStore((s) => s.soundPromptDone)

  useEffect(() => {
    if (!heroReady) return
    playTypingSfx()
    const t = window.setTimeout(() => stopTypingSfx(), HERO_TYPING_MS)
    return () => {
      window.clearTimeout(t)
      stopTypingSfx()
    }
  }, [heroReady])

  const heroRef = useRef(null)
  const cueRef = useRef(null)
  const panelRefs = useRef([])
  const barRef = useRef(null)
  const counterRef = useRef(null)
  const outroRef = useRef(null)
  const systemBoxRef = useRef(null)
  const nextGlobeRef = useRef(null)
  const nextNameRef = useRef(null)

  useEffect(() => {
    const apply = (progress) => {
      if (heroRef.current) {
        const heroOut = smoothstep(0.01, 0.11, progress)
        heroRef.current.style.opacity = String(1 - heroOut)
        heroRef.current.style.transform = `translateY(${heroOut * -40}px)`
      }
      if (cueRef.current) {
        cueRef.current.style.opacity = String(1 - smoothstep(0, 0.04, progress))
      }
      if (systemBoxRef.current) {
        systemBoxRef.current.style.opacity = String(1 - smoothstep(0.004, 0.035, progress))
      }

      let activeIndex = 0
      let nearest = Infinity

      focusMarkers.forEach((marker, i) => {
        const delta = progress - marker.progress
        const absDelta = Math.abs(delta)
        if (absDelta < nearest) {
          nearest = absDelta
          activeIndex = i
        }

        const visible = 1 - smoothstep(PANEL_FULL, PANEL_FADE, absDelta)
        const panel = panelRefs.current[i]
        if (panel) {
          panel.style.opacity = String(visible)
          const y = delta * -120
          const x = (1 - visible) * (projects[i].side === 'left' ? -30 : 30)
          panel.style.transform = `translate3d(${x}px, ${y}px, 0)`
        }
      })

      if (outroRef.current) {
        const outroIn = smoothstep(0.86, 0.98, progress)
        outroRef.current.style.opacity = String(outroIn)
        outroRef.current.style.transform = `translateY(${(1 - outroIn) * 30}px)`
        outroRef.current.style.pointerEvents = outroIn > 0.5 ? 'auto' : 'none'
      }

      // Persistent "next planet" read-out: show the upcoming destination, then
      // retire once we're heading past the final planet into the outro.
      let nextIdx = focusMarkers.findIndex((m) => m.progress > progress + 0.001)
      if (nextIdx === -1) nextIdx = focusMarkers.length - 1
      if (nextNameRef.current) {
        nextNameRef.current.textContent = projects[nextIdx].name.toUpperCase()
      }
      if (nextGlobeRef.current) {
        const lastProg = focusMarkers[focusMarkers.length - 1].progress
        nextGlobeRef.current.style.opacity = String(1 - smoothstep(lastProg - 0.06, lastProg + 0.06, progress))
      }

      if (barRef.current) barRef.current.style.transform = `scaleX(${progress})`
      if (counterRef.current) {
        counterRef.current.textContent = `SECTOR 0${activeIndex + 1} / 0${projects.length}`
      }
    }

    apply(useStore.getState().progress)
    return useStore.subscribe((state) => apply(state.progress))
  }, [])

  const scrollToProgress = (target, duration = 1.3) => {
    const lenis = useStore.getState().lenis
    if (!lenis) return
    const limit =
      lenis.limit || document.documentElement.scrollHeight - window.innerHeight
    lenis.scrollTo(target * limit, { duration })
  }

  // Intro CTA: play feedback and glide from the establishing shot into the
  // first planet, mirroring the old scroll-driven zoom.
  const enterSystem = () => {
    playSfx()
    scrollToProgress(focusMarkers[0].progress, 1.8)
  }

  // Step prev/next through the waypoints relative to the nearest one.
  const step = (dir) => {
    playSfx()
    const progress = useStore.getState().progress
    let idx = 0
    let nearest = Infinity
    WAYPOINTS.forEach((w, i) => {
      const d = Math.abs(w - progress)
      if (d < nearest) {
        nearest = d
        idx = i
      }
    })
    const next = clamp(idx + dir, 0, WAYPOINTS.length - 1)
    scrollToProgress(WAYPOINTS[next], 1.2)
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-10 select-none">
      <ScreenFrame />

      <p className="absolute right-8 top-[22px] text-right text-[10px] tracking-[0.22em] text-white/45 md:right-10 md:top-6 md:text-[11px]">
        Made by Adrian Partain
      </p>

      {/* ---- Bounding box framing the system (bottom-right): only a top edge,
              left edge and chamfered top-left corner — the open right/bottom
              sides run into the screen's perimeter frame (inset-4 = 16px).
              Fades out as the camera travels into the system. ---- */}
      <div
        ref={systemBoxRef}
        className="pointer-events-none absolute"
        style={{
          left: '63%',
          top: '64%',
          right: 16,
          bottom: 16,
          filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))',
          willChange: 'opacity',
        }}
      >
        {/* top edge: lower run, then an early chamfer up to a raised run that
            continues to the right frame — a trapezoidal tab sticking out the
            top-right. */}
        <span className="absolute top-0" style={{ left: SYS_CHAMFER, width: `calc(${SYS_TAB_AT} - ${SYS_CHAMFER}px)`, height: 2, background: SYS_LINE }} />
        <span
          className="absolute top-0"
          style={{
            left: SYS_TAB_AT,
            width: SYS_DIAG,
            height: 2,
            background: SYS_LINE,
            transformOrigin: 'left center',
            transform: 'rotate(-45deg)',
          }}
        />
        <span
          className="absolute"
          style={{ left: `calc(${SYS_TAB_AT} + ${SYS_CHAMFER}px)`, right: 0, top: -SYS_CHAMFER, height: 2, background: SYS_LINE }}
        />
        {/* left edge (starts past the chamfer, runs to the bottom frame) */}
        <span className="absolute left-0" style={{ top: SYS_CHAMFER, bottom: 0, width: 2, background: SYS_LINE }} />
        {/* chamfered top-left corner */}
        <span
          className="absolute"
          style={{
            left: 0,
            top: SYS_CHAMFER,
            width: SYS_DIAG,
            height: 2,
            background: SYS_LINE,
            transformOrigin: 'left center',
            transform: 'rotate(-45deg)',
          }}
        />

        {/* sci-fi instrument cluster around the frame */}
        <SystemHud chamfer={SYS_CHAMFER} tabAt={SYS_TAB_AT} />
      </div>

      {/* -------------- Audio: mute toggle + equalizer (right edge) ----- */}
      <div className="absolute right-10 top-[48%] flex -translate-y-1/2 flex-col items-end gap-3 md:right-12">
        <button
          type="button"
          onClick={toggleMuted}
          aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          aria-pressed={muted}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center border border-white/40 text-white/80 transition-colors duration-200 hover:border-white/80 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 9v6h4l5 4V5L8 9H4z"
              fill="currentColor"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {muted ? (
              <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            ) : (
              <>
                <path d="M16.5 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <path d="M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </>
            )}
          </svg>
        </button>
        <AudioMeter />
      </div>

      {/* ------- Persistent "next planet" read-out (whole journey) ------ */}
      <div
        ref={nextGlobeRef}
        className="pointer-events-none absolute bottom-16 left-8 md:left-16"
        style={{ willChange: 'opacity' }}
      >
        <WireGlobe nameRef={nextNameRef} />
      </div>

      {/* ---------------------------- Hero ----------------------------- */}
      <div
        ref={heroRef}
        className="absolute inset-0 flex items-start justify-start px-8 pt-24 md:px-16 md:pt-28"
        style={{ willChange: 'opacity, transform' }}
      >
        <div className="max-w-2xl text-left">
          <p className="text-[11px] tracking-[0.4em] text-[var(--color-hud)] [text-shadow:0_0_12px_rgba(127,200,255,0.6)]">
            <TypewriterReveal text="ORBITAL UPLINK ESTABLISHED // CLEARANCE GRANTED" on={heroReady} start={0} stagger={0.01} />
          </p>
          <h1 className="animate-glow-flicker mt-4 text-4xl font-700 leading-[1.04] text-[var(--color-ice)] [text-shadow:0_0_24px_rgba(120,180,255,0.55),0_0_48px_rgba(80,140,255,0.35)] md:text-6xl lg:text-7xl">
            <TypewriterReveal text="ENTERING" on={heroReady} start={0.45} stagger={0.03} />
            <br />
            <TypewriterReveal
              text="ALPHA"
              on={heroReady}
              start={0.72}
              stagger={0.03}
              className="text-[var(--color-hud)]"
            />
            <br />
            <TypewriterReveal
              text="PARTANIA"
              on={heroReady}
              start={0.95}
              stagger={0.03}
              className="text-[var(--color-hud)]"
            />
            <br />
            <TypewriterReveal text="SYSTEM" on={heroReady} start={1.18} stagger={0.03} />
          </h1>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-[var(--color-ice)]/55">
            <TypewriterReveal
              text="The complete stellar archive of Adrian Partain — every project engineered, charted, and set in orbit. Each world a deployed work, awaiting your approach."
              on={heroReady}
              start={1.5}
              stagger={0.006}
            />
          </p>

          <HudButton
            onClick={enterSystem}
            className={[
              'pointer-events-auto mt-8 gap-4 px-12 py-5 text-base tracking-[0.35em]',
              'transition-[opacity,background-color] duration-500 ease-out',
              heroReady ? 'opacity-100' : 'opacity-0 pointer-events-none',
            ].join(' ')}
            style={{ transitionDelay: heroReady ? '2.4s' : '0s' }}
          >
            ENTER THE SYSTEM
            <svg width="24" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14M13 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </HudButton>
        </div>

        <div
          ref={cueRef}
          className="absolute bottom-28 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
        >
          <span className="text-[10px] tracking-[0.35em] text-[var(--color-hud)]/70">
            SCROLL
          </span>
          <span className="relative flex h-9 w-5 justify-center rounded-full border border-[var(--color-hud)]/40">
            <span className="animate-scroll-cue mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--color-hud)]" />
          </span>
        </div>
      </div>

      {/* ----------------------- Project read-outs --------------------- */}
      {projects.map((project, i) => {
        const isLeft = project.side === 'left'
        return (
          <div
            key={project.id}
            className={[
              'absolute inset-0 flex items-end px-6 pb-28',
              'md:items-center md:pb-0',
              isLeft
                ? 'justify-center md:justify-start md:pl-[7vw]'
                : 'justify-center md:justify-end md:pr-[7vw]',
            ].join(' ')}
          >
            <div
              ref={(el) => (panelRefs.current[i] = el)}
              className="w-full max-w-sm"
              style={{ opacity: 0, willChange: 'opacity, transform' }}
            >
              <HudFrame
                label={`PROJECT 0${project.id} // ${project.name.toUpperCase()}`}
                align={isLeft ? 'left' : 'right'}
                className={isLeft ? 'text-left' : 'text-left md:text-right'}
              >
                <h2 className="text-3xl font-700 leading-none text-white md:text-5xl">
                  {project.name}
                </h2>
                <p className="mt-3 text-base text-[var(--color-ice)]/85 md:text-lg">
                  {project.description}
                </p>
                <p className="mt-3 text-xs leading-relaxed text-[var(--color-ice)]/55">
                  {project.tagline}
                </p>

                <div
                  className={[
                    'mt-4 flex flex-wrap gap-2',
                    isLeft ? '' : 'md:justify-end',
                  ].join(' ')}
                >
                  {project.stack.map((tech) => (
                    <span
                      key={tech}
                      className="border border-[var(--color-hud)]/25 bg-[var(--color-hud)]/5 px-2.5 py-1 text-[10px] tracking-widest text-[var(--color-hud)]/80"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <div
                  className={[
                    'mt-4 flex items-center gap-4 border-t border-[var(--color-hud)]/15 pt-3 text-[10px] tracking-[0.25em] text-[var(--color-ice)]/40',
                    isLeft ? '' : 'md:justify-end',
                  ].join(' ')}
                >
                  <span>YEAR · {project.year}</span>
                  <span>STATUS · DEPLOYED</span>
                </div>
              </HudFrame>
            </div>
          </div>
        )
      })}

      {/* ---------------------------- Outro ---------------------------- */}
      <div
        ref={outroRef}
        className="absolute inset-0 flex flex-col items-center justify-center px-6"
        style={{ opacity: 0, pointerEvents: 'none', willChange: 'opacity, transform' }}
      >
        <HudFrame label="END OF TRANSMISSION" className="w-full max-w-xl text-center">
          <h2 className="text-3xl font-700 leading-tight text-[var(--color-ice)] md:text-5xl">
            LET&apos;S BUILD SOMETHING
            <br />
            <span className="text-[var(--color-hud)]">OUT OF THIS WORLD</span>
          </h2>
          <a
            href="mailto:hello@alphapartania.dev"
            className="mt-7 inline-block border border-[var(--color-hud)]/50 bg-[var(--color-hud)]/10 px-7 py-3 text-xs tracking-[0.25em] text-[var(--color-ice)] transition-colors duration-300 hover:bg-[var(--color-hud)]/25"
          >
            ESTABLISH CONTACT
          </a>
        </HudFrame>
      </div>

      {/* ------------- Prev / next project nav (near scroll cue) -------- */}
      <div className="pointer-events-auto absolute bottom-12 left-1/2 flex -translate-x-1/2 items-center gap-4">
        <HudButton
          onClick={() => step(-1)}
          aria-label="Previous project"
          chamfer={8}
          className="h-9 w-9 text-white/80 hover:text-white active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </HudButton>
        <span className="text-[9px] tracking-[0.35em] text-white/40">NAVIGATE</span>
        <HudButton
          onClick={() => step(1)}
          aria-label="Next project"
          chamfer={8}
          className="h-9 w-9 text-white/80 hover:text-white active:scale-95"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M9 5l7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </HudButton>
      </div>

      {/* ------------------- Bottom progress / readout ----------------- */}
      <div className="absolute inset-x-0 bottom-0 flex items-center gap-4 px-8 pb-6 md:px-16">
        <span
          ref={counterRef}
          className="whitespace-nowrap text-[10px] tracking-[0.25em] text-[var(--color-hud)]/80"
        >
          SECTOR 01 / 0{projects.length}
        </span>
        <div className="relative h-px flex-1 bg-[var(--color-hud)]/15">
          <div
            ref={barRef}
            className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--color-hud)]"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>
    </div>
  )
}
