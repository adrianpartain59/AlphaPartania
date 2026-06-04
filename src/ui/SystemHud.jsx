/**
 * Small sci-fi HUD instrument cluster that decorates the system bounding box on
 * the landing shot. Everything is intentionally tiny and lives *outside* the
 * frame edges (above the top edge / left of the left edge) so it never covers
 * the solar-system visual. It inherits the bounding box's fade, so it vanishes
 * with the frame as the camera travels in.
 *
 * Widgets: a sweeping radar, a charging energy bar (the "/////" hatch style), a
 * status read-out, and a twin-ring "engine core" animation.
 */

import { useEffect, useState } from 'react'
import { projects } from '../data/projects'

const TINY = 'text-[6px] tracking-[0.3em] text-white/45'
/* On the landing shot the first project is the next destination. */
const NEXT_PLANET = projects[0].name.toUpperCase()

/* Sweeping radar dish. */
function Radar() {
  return (
    <div className="absolute" style={{ left: 16, bottom: 92, width: 52, height: 52 }}>
      <div className="absolute inset-0 rounded-full border border-white/35" />
      <div className="absolute inset-[20%] rounded-full border border-white/20" />
      <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/12" />
      <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/12" />
      {/* rotating sweep wedge */}
      <div className="absolute inset-0 overflow-hidden rounded-full animate-hud-spin">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.34) 46deg, rgba(255,255,255,0) 58deg)',
          }}
        />
      </div>
      {/* contact blip */}
      <span
        className="absolute h-[3px] w-[3px] rounded-full bg-white animate-pulse-soft"
        style={{ left: '64%', top: '38%' }}
      />
      <span className={`absolute -bottom-[10px] left-1/2 -translate-x-1/2 ${TINY}`}>
        RADAR
      </span>
    </div>
  )
}

/* Spinning wireframe globe (CSS 3D meridians + latitudes). */
const GLOBE_MERIDIANS = [0, 30, 60, 90, 120, 150]
const GLOBE_LATS = [-0.5, 0, 0.5] // fraction of the radius

export function WireGlobe({ size = 116, nameRef }) {
  const r = size / 2
  return (
    <div className="pointer-events-none flex flex-col items-start" style={{ fontFamily: 'Orbitron, sans-serif' }}>
      <div className="text-center leading-tight" style={{ width: size }}>
        <div className="text-[8px] tracking-[0.4em] text-white/45">NEXT PLANET</div>
        <div ref={nameRef} className="mt-1 text-xs tracking-[0.25em] text-white/90">{NEXT_PLANET}</div>
      </div>
      <div className="wire-globe mt-3" style={{ width: size, height: size, perspective: size * 4 }}>
        <div className="wire-globe-rot">
          {GLOBE_MERIDIANS.map((a) => (
            <div key={`m${a}`} className="wire-ring" style={{ transform: `rotateY(${a}deg)` }} />
          ))}
          {GLOBE_LATS.map((f) => {
            const s = Math.sqrt(1 - f * f)
            return (
              <div
                key={`l${f}`}
                className="wire-ring"
                style={{ transform: `translateY(${f * r}px) rotateX(90deg) scale(${s})` }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* Twin counter-rotating rings — a little "engine core". */
function EngineCore() {
  return (
    <div className="absolute" style={{ left: 18, bottom: 22, width: 46, height: 46 }}>
      <svg viewBox="0 0 50 50" className="absolute inset-0 animate-hud-spin-slow">
        <circle cx="25" cy="25" r="22" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="4 7" />
      </svg>
      <svg viewBox="0 0 50 50" className="absolute inset-0 animate-hud-spin-rev">
        <circle cx="25" cy="25" r="15" fill="none" stroke="rgba(255,255,255,0.42)" strokeWidth="1" strokeDasharray="2 6" />
      </svg>
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85 animate-pulse-soft" />
      <span className={`absolute -bottom-[10px] left-1/2 -translate-x-1/2 ${TINY}`}>
        CORE
      </span>
    </div>
  )
}

/* Power read-out that fills the trapezoidal top tab: thick diagonal "/////"
   bars (45°, matching the chamfer) that charge up cleanly one at a time, hold
   full, then reset. Clipped to the tab so the left edge follows the chamfer and
   the right meets the frame. */
const PWR_COUNT = 16
const PWR_TICK = 150 // ms between each bar lighting up
const PWR_HOLD = 6 // extra ticks held at full before emptying

function PowerTab({ tabAt, chamfer }) {
  // `lit` counts up bar-by-bar to PWR_COUNT, holds full, then snaps to 0 so the
  // whole row empties at once (rather than a moving gap cycling through).
  const [lit, setLit] = useState(0)
  useEffect(() => {
    let phase = 0
    const id = window.setInterval(() => {
      phase = (phase + 1) % (PWR_COUNT + PWR_HOLD)
      setLit(Math.min(phase, PWR_COUNT))
    }, PWR_TICK)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="absolute flex items-stretch overflow-hidden"
      style={{
        left: tabAt,
        right: 0,
        top: -chamfer,
        height: chamfer,
        clipPath: `polygon(${chamfer}px 0, 100% 0, 100% 100%, 0 100%)`,
      }}
    >
      {Array.from({ length: PWR_COUNT }).map((_, i) => (
        <div key={i} className="flex flex-1 items-end justify-center">
          {/* skip the left-most slot so no bar sits on the chamfer */}
          {i > 0 && (
            <span
              style={{
                width: 6,
                height: '70%',
                background: '#ffffff',
                transform: 'skewX(-45deg)',
                opacity: i < lit ? 1 : 0.15,
                transition: 'opacity 0.1s linear',
              }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* Compact status read-out. */
function StatusBar({ chamfer }) {
  return (
    <div className="absolute flex items-center gap-2" style={{ top: 10, left: chamfer + 8 }}>
      <span className="text-[6px] tracking-[0.3em] text-white/55">SYS.MAP</span>
      <div className="flex gap-[3px]">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-[7px] w-[3px]"
            style={{ background: i < 5 ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.18)' }}
          />
        ))}
      </div>
      <span className="flex items-center gap-1 text-[6px] tracking-[0.3em] text-white/40">
        <span className="h-[3px] w-[3px] rounded-full bg-white/80 animate-hud-blink" />
        LIVE
      </span>
    </div>
  )
}

export default function SystemHud({ chamfer = 22, tabAt = '40%' }) {
  return (
    <>
      <StatusBar chamfer={chamfer} />
      <PowerTab tabAt={tabAt} chamfer={chamfer} />
      <Radar />
      <EngineCore />
      {/* tiny crosshair tucked at the chamfered corner */}
      <span className="absolute" style={{ left: chamfer - 3, top: chamfer - 3, width: 7, height: 7 }}>
        <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/60" />
        <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/60" />
      </span>
      {/* dotted tick descending the left edge */}
      <div className="absolute left-[3px] flex flex-col gap-[5px]" style={{ top: chamfer + 60 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className="h-[2px] w-[2px] rounded-full bg-white/40" />
        ))}
      </div>
    </>
  )
}
