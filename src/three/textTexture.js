import * as THREE from 'three'

/**
 * Renders a project "logo" (its name + a short label) onto a canvas and wraps
 * it in a THREE.CanvasTexture.
 *
 * Why canvas instead of <Text>/SVG? It needs zero network requests (no font or
 * SVG file to fetch), renders crisply at any size, and produces a clean
 * transparent plane that the glass core can refract. We also re-draw once the
 * web font finishes loading so the typography upgrades gracefully.
 *
 * Returns the texture plus the canvas aspect ratio so the plane can be sized
 * without distortion.
 */
export function makeLogoTexture({ name, label, accent = '#c77dff', size = 1024 }) {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  const draw = () => {
    ctx.clearRect(0, 0, size, size)
    const cx = size / 2
    const cy = size / 2

    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Small uppercase label above the name.
    ctx.shadowColor = accent
    ctx.shadowBlur = size * 0.025
    ctx.fillStyle = accent
    ctx.font = `600 ${size * 0.048}px "Orbitron", ui-monospace, monospace`
    ctx.fillText((label || '').toUpperCase(), cx, cy - size * 0.2)

    // The project name — the hero of the logo. Drawn brightly with a strong
    // glow so it stays legible once refracted through the glass core.
    ctx.shadowColor = accent
    ctx.shadowBlur = size * 0.08
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${size * 0.135}px "Orbitron", system-ui, sans-serif`
    ctx.fillText(name.toUpperCase(), cx, cy + size * 0.01)

    // A thin accent rule beneath the name.
    ctx.shadowBlur = size * 0.035
    ctx.fillStyle = accent
    const lineW = size * 0.26
    ctx.fillRect(cx - lineW / 2, cy + size * 0.14, lineW, size * 0.008)
  }

  draw()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  texture.needsUpdate = true

  // Upgrade to the real display font once it's available.
  if (typeof document !== 'undefined' && document.fonts?.ready) {
    document.fonts.ready.then(() => {
      draw()
      texture.needsUpdate = true
    })
  }

  return { texture, aspect: 1 }
}
