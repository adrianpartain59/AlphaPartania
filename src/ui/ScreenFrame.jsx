/**
 * Minimalist sci-fi HUD that hugs the far outer edges of the screen, traced in
 * white only. Faithful to the reference:
 *
 *   • perimeter     thin glowing line; bottom-left corner gap for logo,
 *                   CHAMFERED top-right + bottom-right — no rounded corners.
 *   • bottom-left   AP logo seated in the corner gap
 *   • top-left      "+" crosshair + dotted tick segment
 *   • top-right     chamfer matching the bottom-right cut
 *   • right edge    dotted tick segment
 *   • bottom edge   a thick hatch tab at the bottom-right
 *   • scattered     "+" crosshairs and dotted tick segments
 *
 * Purely decorative + `pointer-events-none` so the cursor still reaches the
 * canvas (parallax + dust repulsion).
 */

import logo from '../assets/images/AlphaPartaniumLogo.png'

const CHAMFER = 22 // size of the triangle-cut corners (top-right + bottom-right)
const CORNER_GAP = 34 // how far frame lines stop short of the bottom-left corner
const LOGO_SIZE = 44 // logo dimensions — independent of the line gap
const FRAME_INSET = 16 // matches Tailwind inset-4
const DIAG = CHAMFER * Math.SQRT2 // length of the chamfer line
const LINE = 'rgba(255,255,255,0.9)'

/* A crosshair "+" mark. */
function Plus({ className = '', size = 12 }) {
  return (
    <span className={`absolute ${className}`} style={{ width: size, height: size }}>
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/85" />
      <span className="absolute top-1/2 left-0 h-px w-full -translate-y-1/2 bg-white/85" />
    </span>
  )
}

/* A block of thick, evenly-spaced diagonal hatch bars ("/ / /"). */
function Hatch({ className = '', style, count = 6, gap = 11, h = 18, stroke = 4 }) {
  const w = (count - 1) * gap + h + stroke
  return (
    <svg
      className={`absolute ${className}`}
      style={style}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
    >
      {Array.from({ length: count }).map((_, i) => {
        const x0 = i * gap
        return (
          <polygon
            key={i}
            points={`${x0},${h} ${x0 + stroke},${h} ${x0 + h + stroke},0 ${x0 + h},0`}
            fill="white"
            fillOpacity={0.9}
          />
        )
      })}
    </svg>
  )
}

/* A short row/column of tiny dots (a dotted tick segment). */
function Dots({ className = '', count = 7 }) {
  return (
    <div className={`absolute flex items-center gap-1.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="rounded-full bg-white/55" style={{ width: 2, height: 2 }} />
      ))}
    </div>
  )
}

export default function ScreenFrame() {
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* ---- Perimeter: corner gap bottom-left, chamfered top/bottom-right ---- */}
      <div
        className="absolute inset-4"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}
      >
        {/* straight edges */}
        <span className="absolute left-0 top-0" style={{ right: CHAMFER, height: 2, background: LINE }} />
        <span className="absolute left-0 top-0" style={{ bottom: CORNER_GAP, width: 2, background: LINE }} />
        <span
          className="absolute right-0"
          style={{ top: CHAMFER, bottom: CHAMFER, width: 2, background: LINE }}
        />
        <span
          className="absolute bottom-0"
          style={{ left: CORNER_GAP, right: CHAMFER, height: 2, background: LINE }}
        />
        {/* triangle-cut corners (top-right + bottom-right) */}
        <span
          className="absolute"
          style={{
            right: 0,
            top: CHAMFER,
            width: DIAG,
            height: 2,
            background: LINE,
            transformOrigin: 'right center',
            transform: 'rotate(45deg)',
          }}
        />
        <span
          className="absolute"
          style={{
            right: 0,
            bottom: CHAMFER,
            width: DIAG,
            height: 2,
            background: LINE,
            transformOrigin: 'right center',
            transform: 'rotate(-45deg)',
          }}
        />
      </div>

      {/* ---- Bottom-left: logo in the corner gap ---- */}
      <img
        src={logo}
        alt="Alpha Partanium"
        className="absolute"
        style={{
          bottom: 0,
          left: 0,
          width: LOGO_SIZE,
          height: LOGO_SIZE,
        }}
        draggable={false}
      />

      {/* ---- Top-left: crosshair + dotted tick ---- */}
      <Plus className="left-12 top-14" />
      <Dots className="left-[34%] top-[15px]" count={8} />

      {/* ---- Right edge: dotted tick ---- */}
      <Dots className="right-[18px] top-[58%] flex-col gap-1.5" count={6} />

      {/* ---- Bottom edge: hatch tab flush against bottom-right chamfer ---- */}
      <Hatch className="bottom-[26px]" style={{ right: FRAME_INSET + 12 }} count={6} h={16} />
    </div>
  )
}
