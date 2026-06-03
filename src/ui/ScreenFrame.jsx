/**
 * Minimalist sci-fi HUD that hugs the far outer edges of the screen, traced in
 * white only. Faithful to the reference:
 *
 *   • perimeter     thin glowing line; SHARP top corners, CHAMFERED (triangle-
 *                   cut) bottom corners — no rounded corners anywhere.
 *   • top-left      thick diagonal hatch tab ("/ / /") + a "+" crosshair
 *   • top-right     solid filled right-triangle in the corner
 *   • right edge    a vertical stack of three rings + "+" crosshairs
 *   • bottom edge   a thick hatch tab with a small notch/dip in the line
 *   • bottom-left   a vertical stack of two rings
 *   • scattered     "+" crosshairs and dotted tick segments
 *
 * Purely decorative + `pointer-events-none` so the cursor still reaches the
 * canvas (parallax + dust repulsion).
 */

const CHAMFER = 22 // size of the bottom triangle-cut corners
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
function Hatch({ className = '', count = 6, gap = 11, h = 18, stroke = 4 }) {
  const w = (count - 1) * gap + h
  return (
    <svg
      className={`absolute ${className}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      fill="none"
    >
      {Array.from({ length: count }).map((_, i) => (
        <line
          key={i}
          x1={i * gap}
          y1={h}
          x2={i * gap + h}
          y2={0}
          stroke="white"
          strokeOpacity={0.9}
          strokeWidth={stroke}
        />
      ))}
    </svg>
  )
}

/* A vertical stack of small hollow rings. */
function Rings({ className = '', count = 3 }) {
  return (
    <div className={`absolute flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="h-2.5 w-2.5 rounded-full border border-white/75" />
      ))}
    </div>
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
      {/* ---- Perimeter: sharp top corners, chamfered bottom corners ---- */}
      <div
        className="absolute inset-4"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.4))' }}
      >
        {/* straight edges */}
        <span className="absolute left-0 right-0 top-0" style={{ height: 2, background: LINE }} />
        <span className="absolute left-0 top-0" style={{ bottom: CHAMFER, width: 2, background: LINE }} />
        <span className="absolute right-0 top-0" style={{ bottom: CHAMFER, width: 2, background: LINE }} />
        <span className="absolute bottom-0" style={{ left: CHAMFER, right: CHAMFER, height: 2, background: LINE }} />
        {/* bottom triangle-cut corners */}
        <span
          className="absolute"
          style={{
            left: 0,
            bottom: CHAMFER,
            width: DIAG,
            height: 2,
            background: LINE,
            transformOrigin: 'left center',
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

      {/* ---- Top-left: thick hatch tab + crosshair ---- */}
      <Hatch className="left-12 top-[18px]" count={6} />
      <Plus className="left-12 top-14" />
      <Dots className="left-[34%] top-[15px]" count={8} />

      {/* ---- Top-right: solid filled triangle in the corner ---- */}
      <svg className="absolute right-4 top-4" width="34" height="34" viewBox="0 0 34 34">
        <polygon points="34,0 0,0 34,34" fill="rgba(255,255,255,0.85)" />
      </svg>

      {/* ---- Right edge: three rings + crosshairs ---- */}
      <Rings className="right-[22px] top-[26%]" count={3} />
      <Plus className="right-11 top-[26%]" />
      <Dots className="right-[18px] top-[58%] flex-col gap-1.5" count={6} />

      {/* ---- Bottom-right: inner crosshair ---- */}
      <Plus className="bottom-12 right-12" />

      {/* ---- Bottom edge: thick hatch tab + small notch/dip ---- */}
      <Hatch className="bottom-[18px] left-[56%]" count={6} />
      <span className="absolute bottom-4 left-1/2 h-3 w-20 -translate-x-1/2 translate-y-3 border-x border-b border-white/45" />

      {/* ---- Bottom-left / left edge: two rings + crosshair ---- */}
      <Rings className="left-[22px] bottom-[26%]" count={2} />
      <Plus className="left-12 bottom-14" />
    </div>
  )
}
