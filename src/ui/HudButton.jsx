import { useLayoutEffect, useRef, useState } from 'react'

const CHAMFER_DEFAULT = 16

function buildChamferPath(w, h, c) {
  return `M ${c} 0 H ${w} V ${h - c} L ${w - c} ${h} H 0 V ${c} Z`
}

function buildClipPath(c) {
  return `polygon(${c}px 0, 100% 0, 100% calc(100% - ${c}px), calc(100% - ${c}px) 100%, 0 100%, 0 ${c}px)`
}

/**
 * Chamfered HUD button with a dashed outline whose gaps travel around the
 * perimeter. Outline geometry is measured from the rendered box so one
 * component works for wide CTAs and square icon controls.
 */
export default function HudButton({
  chamfer = CHAMFER_DEFAULT,
  className = '',
  style,
  children,
  ...props
}) {
  const btnRef = useRef(null)
  const [dims, setDims] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const node = btnRef.current
    if (!node) return

    const update = () => {
      const { width, height } = node.getBoundingClientRect()
      setDims({
        w: Math.max(1, Math.round(width)),
        h: Math.max(1, Math.round(height)),
      })
    }

    update()
    const ro = new ResizeObserver(update)
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  const c = Math.min(chamfer, dims.w / 2 - 1, dims.h / 2 - 1)

  return (
    <button
      ref={btnRef}
      type="button"
      className={[
        'hud-btn group relative inline-flex items-center justify-center',
        'text-[var(--color-ice)] transition-[opacity,background-color,color,transform] duration-500 ease-out',
        className,
      ].join(' ')}
      style={{
        clipPath: dims.w ? buildClipPath(c) : undefined,
        ...style,
      }}
      {...props}
    >
      {dims.w > 0 && (
        <svg
          className="hud-btn-outline pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${dims.w} ${dims.h}`}
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d={buildChamferPath(dims.w, dims.h, c)}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
      <span className="relative z-10 contents">{children}</span>
    </button>
  )
}
