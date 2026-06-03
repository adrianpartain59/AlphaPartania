/**
 * A reusable sci-fi terminal panel: chamfered (cut-corner) silhouette, a thin
 * glowing accent outline with a soft halo, corner brackets on the square
 * corners, a scanline surface, and an optional header strip (filled tab +
 * label + deco squares + fading rule). Used to wrap project read-outs, the hero
 * and the outro so every bit of copy feels like it's on a HUD.
 */
export default function HudFrame({
  label,
  accent = 'var(--color-hud)',
  align = 'left',
  children,
  className = '',
}) {
  const isRight = align === 'right'

  return (
    <div className={`relative ${className}`}>
      {/* Soft outer halo */}
      <div
        aria-hidden
        className="hud-clip absolute -inset-1 blur-md"
        style={{ background: accent, opacity: 0.16 }}
      />
      {/* Accent outline */}
      <div
        aria-hidden
        className="hud-clip absolute inset-0"
        style={{ background: accent, opacity: 0.7 }}
      />
      {/* Inner terminal surface */}
      <div
        aria-hidden
        className="hud-clip hud-scanlines absolute inset-[1.5px]"
        style={{ backgroundColor: 'rgba(7,13,24,0.78)' }}
      />

      {/* Corner brackets on the two square corners */}
      <span
        aria-hidden
        className="absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2"
        style={{ borderColor: accent }}
      />
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2"
        style={{ borderColor: accent }}
      />

      {/* Content */}
      <div className="relative px-5 py-4 md:px-6 md:py-5">
        {label && (
          <div
            className={`mb-3 flex items-center gap-2 ${
              isRight ? 'flex-row-reverse' : ''
            }`}
          >
            <span
              className="h-3 w-6"
              style={{ backgroundColor: accent, clipPath: 'polygon(0 0,100% 0,85% 100%,0 100%)' }}
            />
            <span
              className="whitespace-nowrap text-[10px] tracking-[0.3em]"
              style={{ color: accent }}
            >
              {label}
            </span>
            <span className="flex items-center gap-1">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5"
                  style={{ backgroundColor: accent, opacity: 0.4 + d * 0.2 }}
                />
              ))}
            </span>
            <span
              className="h-px flex-1"
              style={{
                background: `linear-gradient(${
                  isRight ? 'to left' : 'to right'
                }, ${accent}, transparent)`,
              }}
            />
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
