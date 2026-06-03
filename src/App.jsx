import { Canvas } from '@react-three/fiber'
import { sceneConfig, projects } from './data/projects'
import Experience from './three/Experience'
import Overlay from './ui/Overlay'
import Loader from './ui/Loader'
import SoundPrompt from './ui/SoundPrompt'
import { useSmoothScroll } from './hooks/useSmoothScroll'
import { useAudio } from './hooks/useAudio'

/**
 * App layout:
 *
 *   • A fixed, full-viewport <Canvas> pinned behind everything (z-0).
 *   • A pointer-events-none HTML <Overlay> on top (z-10).
 *   • A <Loader> curtain (z-50) for the first paint.
 *   • A tall, empty "scroll track" that gives the document its scrollable
 *     height — Lenis smooths it and the camera reads the resulting progress.
 *
 * Because the canvas is fixed and the overlay lets pointer events fall through,
 * the mouse keeps driving the 3D parallax and particle repulsion even while
 * you scroll the page.
 */
export default function App() {
  useSmoothScroll()
  useAudio()

  return (
    <>
      <div className="fixed inset-0 z-0 h-[100svh] w-screen bg-[var(--color-void)]">
        <Canvas
          dpr={[1, 2]}
          gl={{
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
          }}
          camera={{
            position: sceneConfig.camera.overview.position,
            fov: sceneConfig.camera.fov,
            near: 0.1,
            far: 700,
          }}
        >
          <Experience />
        </Canvas>
      </div>

      <Overlay />
      <Loader />
      <SoundPrompt />

      {/* Empty scroll track — its height defines how far you can travel. */}
      <div
        aria-hidden
        style={{ height: `${(projects.length + 1.5) * 100}svh` }}
      />
    </>
  )
}
