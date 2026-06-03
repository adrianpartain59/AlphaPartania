import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import stackSheet from '../assets/loader-stack.png'

/* -------------------------------------------------------------------------- */
/*  Sprite-sheet layout — MUST match scripts/bake-loader.mjs.                  */
/* -------------------------------------------------------------------------- */
const FRAME = 384
const FRAMES = 96
const COLS = 12
const FPS = 30

/* Stack build timing — keep in sync with bake-loader.mjs animation tuning. */
const LAYER_COUNT = 4
const BUILD_DELAY = 0.32
const BUILD_DURATION = 0.6
const STACK_BUILD_MS =
  ((LAYER_COUNT - 1) * BUILD_DELAY + BUILD_DURATION) * 1000

const MIN_DURATION_MS = 5000
const DRAW_SIZE = 200
const TEXT_FADE_MS = 650

const TERMINAL_LINES = [
  'SCANNING SECTOR GRID',
  'CALIBRATING ORBITAL PATHS',
  'SYNCHRONISING UPLINK',
  'MAPPING TRAJECTORY NODES',
  'VERIFYING CLEARANCE',
]

/* -------------------------------------------------------------------------- */
/*  Bit-by-bit terminal line: types out quickly, then loops to the next line.  */
/* -------------------------------------------------------------------------- */
function TerminalLoader({ active }) {
  const [lineIndex, setLineIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)

  const line = TERMINAL_LINES[lineIndex]

  useEffect(() => {
    if (!active) {
      setLineIndex(0)
      setCharCount(0)
      return
    }

    const typeId = window.setInterval(() => {
      setCharCount((n) => {
        if (n < line.length) return n + 1
        return n
      })
    }, 32)

    return () => window.clearInterval(typeId)
  }, [active, line.length])

  useEffect(() => {
    if (!active || charCount < line.length) return
    const t = window.setTimeout(() => {
      setLineIndex((i) => (i + 1) % TERMINAL_LINES.length)
      setCharCount(0)
    }, 90)
    return () => window.clearTimeout(t)
  }, [active, charCount, line.length])

  if (!active) return null

  const typed = line.slice(0, charCount)

  return (
    <div className="flex w-max min-w-[34ch] flex-col items-center justify-center">
      <p className="whitespace-nowrap font-mono text-[10px] tracking-[0.2em] text-white/50">
        <span className="text-white/65">&gt;</span> {typed}
        <span className="animate-hud-blink text-white/45">
          {charCount < line.length ? '▌' : '_'}
        </span>
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Loading screen                                                             */
/* -------------------------------------------------------------------------- */
export default function LoadingScreen() {
  const ready = useStore((s) => s.ready)
  const setLoadingDone = useStore((s) => s.setLoadingDone)
  const [minElapsed, setMinElapsed] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [stackComplete, setStackComplete] = useState(false)
  const [terminalActive, setTerminalActive] = useState(false)
  const canvasRef = useRef(null)
  const stackDoneRef = useRef(false)

  const fading = ready && minElapsed
  const showCopy = stackComplete && !fading

  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), MIN_DURATION_MS)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!fading) return
    const t = window.setTimeout(() => {
      setRemoved(true)
      setLoadingDone(true)
    }, 700)
    return () => window.clearTimeout(t)
  }, [fading, setLoadingDone])

  // Start the terminal loop after the wordmark has faded in.
  useEffect(() => {
    if (!stackComplete) {
      setTerminalActive(false)
      return
    }
    const t = window.setTimeout(() => setTerminalActive(true), TEXT_FADE_MS)
    return () => window.clearTimeout(t)
  }, [stackComplete])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = DRAW_SIZE * dpr
    canvas.height = DRAW_SIZE * dpr

    const img = new Image()
    let raf = 0
    let start = 0

    const drawFrame = (frame) => {
      const col = frame % COLS
      const row = Math.floor(frame / COLS)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(
        img,
        col * FRAME,
        row * FRAME,
        FRAME,
        FRAME,
        0,
        0,
        canvas.width,
        canvas.height,
      )
    }

    const tick = (now) => {
      if (!start) start = now
      const elapsed = now - start
      const frame = Math.min(Math.floor((elapsed / 1000) * FPS), FRAMES - 1)
      drawFrame(frame)

      if (!stackDoneRef.current && elapsed >= STACK_BUILD_MS) {
        stackDoneRef.current = true
        setStackComplete(true)
      }

      if (frame < FRAMES - 1) raf = requestAnimationFrame(tick)
    }

    img.onload = () => {
      raf = requestAnimationFrame(tick)
    }
    img.src = stackSheet

    return () => cancelAnimationFrame(raf)
  }, [])

  const statusLine = useMemo(
    () => (ready ? 'ENTERING SYSTEM' : 'INITIALISING ORBITAL SYSTEMS'),
    [ready],
  )

  if (removed) return null

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex flex-col items-center justify-center bg-black',
        'transition-opacity duration-700 ease-out',
        fading ? 'pointer-events-none opacity-0' : 'opacity-100',
      ].join(' ')}
    >
      <canvas
        ref={canvasRef}
        style={{ width: DRAW_SIZE, height: DRAW_SIZE }}
        className="block"
      />

      <div className="pointer-events-none relative mt-6 flex flex-col items-center">
        <div
          className={[
            'flex flex-col items-center',
            'transition-opacity duration-[650ms] ease-out',
            showCopy ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={!showCopy}
        >
          <p className="text-sm font-700 tracking-[0.35em] text-white/90">
            ALPHA<span className="text-white/50">PARTANIA</span>
          </p>
          <p className="mt-3 text-[10px] tracking-[0.45em] text-white/40">
            {statusLine}
          </p>
        </div>
        {/* Out of flow so the terminal never shifts the wordmark upward. */}
        <div className="absolute left-1/2 top-full flex w-full -translate-x-1/2 justify-center pt-4">
          <TerminalLoader active={terminalActive && !fading} />
        </div>
      </div>
    </div>
  )
}
