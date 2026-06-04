import { Canvas } from '@react-three/fiber'
import WireShip from '../three/WireShip'

const HUD = 'var(--color-hud)'

/** The live 3D orbiter, rendered into its own transparent canvas (no backing). */
function ShipFeed() {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 2.4, 10.5], fov: 38 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <WireShip ui />
    </Canvas>
  )
}

/** A labelled horizontal meter (label + value over a thin filled track). */
function StatBar({ label, value, pct }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[9px] tracking-[0.22em] text-white/55">
        <span>{label}</span>
        <span className="text-white/85">{value}</span>
      </div>
      <div className="mt-1 h-[3px] w-full bg-white/10">
        <div className="h-full bg-white/80" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** A compact key/value readout cell. */
function Readout({ label, value }) {
  return (
    <div className="flex flex-col">
      <span className="text-[6px] tracking-[0.26em] text-white/40">{label}</span>
      <span className="text-[10px] tracking-[0.1em] text-white/85">{value}</span>
    </div>
  )
}

const SYSTEMS = [
  ['NAV', 'ONLINE'],
  ['LIFE SUPPORT', 'NOMINAL'],
  ['RCS', 'ARMED'],
  ['HEAT SHIELD', 'GREEN'],
]

/**
 * Top-right landing-page panel: a sci-fi "orbiter status" terminal. Telemetry
 * runs down the left, the live 3D shuttle floats on the right. Pure line-art —
 * a thin outlined frame with corner brackets and no filled/scanline surface —
 * so it matches the transparent solar-system HUD rather than a TV screen.
 */
export default function ShipStatus() {
  return (
    <div className="w-[280px] md:w-[330px]" style={{ fontFamily: 'inherit' }}>
      {/* ---- Header strip ---- */}
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="h-2.5 w-5"
          style={{ backgroundColor: HUD, clipPath: 'polygon(0 0,100% 0,85% 100%,0 100%)' }}
        />
        <span className="whitespace-nowrap text-[9px] tracking-[0.3em]" style={{ color: HUD }}>
          ORBITER // OV-104
        </span>
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((d) => (
            <span key={d} className="h-1 w-1" style={{ backgroundColor: HUD, opacity: 0.4 + d * 0.2 }} />
          ))}
        </span>
        <span className="h-px flex-1" style={{ background: `linear-gradient(to right, ${HUD}, transparent)` }} />
      </div>

      {/* ---- Outlined frame (transparent), telemetry | ship ---- */}
      <div
        className="relative flex gap-3 border border-white/20 p-3"
        style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.18))' }}
      >
        {/* left: telemetry */}
        <div className="flex w-[116px] shrink-0 flex-col justify-between md:w-[132px]">
          <div className="space-y-1.5">
            <StatBar label="HULL INTEGRITY" value="98%" pct={98} />
            <StatBar label="THERMAL" value="86%" pct={86} />
            <StatBar label="FUEL CELL" value="72%" pct={72} />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 border-t border-white/10 pt-2.5">
            <Readout label="ALTITUDE" value="412 KM" />
            <Readout label="VELOCITY" value="7.66 KM/S" />
            <Readout label="INCLIN." value="51.6°" />
            <Readout label="PERIOD" value="92 MIN" />
          </div>
        </div>

        {/* right: small live 3D orbiter up top, systems checklist below */}
        <div className="flex flex-1 flex-col">
          <div className="relative h-[112px]">
            <div className="absolute inset-0">
              <ShipFeed />
            </div>
            <span className="absolute right-0 top-0 flex items-center gap-1 text-[6px] tracking-[0.3em] text-white/40">
              <span className="h-1 w-1 rounded-full bg-white/80 animate-hud-blink" />
              TRACKING
            </span>
          </div>

          <div className="mt-2 space-y-1 border-t border-white/10 pt-2">
            {SYSTEMS.map(([sys, state]) => (
              <div key={sys} className="flex items-center gap-1">
                <span className="h-1 w-1 shrink-0 rounded-full bg-white/80 animate-pulse-soft" />
                <span className="text-[7px] tracking-[0.2em] text-white/45">{sys}</span>
                <span className="ml-auto text-[7px] tracking-[0.2em]" style={{ color: HUD }}>
                  {state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
