import { useEffect, useState } from 'react'
import {
  collectDomSurfaces,
  domToWorldSurface,
  resolveHeroWorldOrigin,
  type WorldSurface,
} from './surface-registry'
import { evaluatePlatformBounds } from './platform-movement'

interface RobotTelemetry {
  platformId: string
  state: string
  minX: number
  maxX: number
  supportLost: boolean
  flightState?: string
  hoverHeight?: number
  boosterIntensity?: number
  booster?: {
    forced: boolean
    intensity: number
    visible: boolean
    worldPositions: number[][]
  }
  scrollDirection?: string
  scrollVelocity?: number
  scrollInactiveMs?: number
  viewportPosition?: { x: number; y: number }
  targetPosition?: { x: number; y: number } | null
  activeSimulationLoops?: number
  transitionCount?: number
  positionOwner?: string
  frameTimeMs?: number
  largestFrameDisplacement?: number
}

const DEFAULT_ROBOT_HALF_WIDTH = 0.55

export function SurfaceDebugOverlay() {
  const [enabled, setEnabled] = useState(false)
  const [surfaces, setSurfaces] = useState<WorldSurface[]>([])
  const [selectedId, setSelectedId] = useState('hero-platform-1')
  const [telemetry, setTelemetry] = useState<RobotTelemetry | null>(null)
  const [forceNitro, setForceNitro] = useState(false)

  useEffect(() => {
    if (!enabled) return

    let raf = 0
    const refresh = () => {
      raf = 0
      const heroHost = document.querySelector<HTMLElement>('[data-hero-robot]')
      if (!heroHost) {
        setSurfaces([])
        return
      }
      const viewHeightWorld =
        Number.parseFloat(heroHost.dataset.worldHeight ?? '') || 5.1
      const origin = resolveHeroWorldOrigin(heroHost, viewHeightWorld)
      if (!origin) return
      const next = collectDomSurfaces(document).map((s) =>
        domToWorldSurface(s, origin),
      )
      setSurfaces(next)
      if (next.length > 0 && !next.some((s) => s.id === selectedId)) {
        setSelectedId(next[0].id)
      }
    }

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(refresh)
    }

    const handleTelemetry = (event: Event) => {
      const detail = (event as CustomEvent<RobotTelemetry>).detail
      if (detail) setTelemetry(detail)
    }
    const handleForceState = (event: Event) =>
      setForceNitro(Boolean((event as CustomEvent<boolean>).detail))

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('portfolio:robot-telemetry', handleTelemetry)
    window.addEventListener('portfolio:force-nitro-state', handleForceState)
    schedule()

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('portfolio:robot-telemetry', handleTelemetry)
      window.removeEventListener(
        'portfolio:force-nitro-state',
        handleForceState,
      )
    }
  }, [enabled, selectedId])

  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0
  const selectedSurface = surfaces.find((s) => s.id === selectedId)
  const selectedEval = selectedSurface
    ? evaluatePlatformBounds(selectedSurface, DEFAULT_ROBOT_HALF_WIDTH)
    : null

  return (
    <>
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setEnabled((v) => !v)}
          data-robot-surface-debug-toggle=""
          className="w-fit rounded border border-emerald-500/70 bg-background/90 px-2.5 py-1.5 font-mono text-xs text-emerald-400"
        >
          {enabled ? `Surfaces: ON (${surfaces.length})` : 'Surfaces: OFF'}
        </button>
        {enabled && (
          <div className="flex max-w-xs flex-col gap-2 rounded border border-emerald-500/50 bg-background/95 p-2.5 font-mono text-[11px] text-foreground">
            <select
              aria-label="Select platform"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="rounded border border-line bg-background px-2 py-1 text-xs text-foreground"
            >
              {surfaces.map((s) => {
                const info = evaluatePlatformBounds(s, DEFAULT_ROBOT_HALF_WIDTH)
                return (
                  <option key={s.id} value={s.id}>
                    {s.id} · {Math.round(s.pxWidth)}px (
                    {info.walkableWidth.toFixed(2)}u)
                    {!info.canStand ? ' [Too Narrow]' : ''}
                  </option>
                )
              })}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!selectedEval?.canStand}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('portfolio:place-robot', {
                      detail: { platformId: selectedId },
                    }),
                  )
                }
                className="rounded border border-emerald-500/70 px-2 py-1 text-emerald-400 disabled:opacity-40"
              >
                Place Robot
              </button>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('portfolio:place-robot', {
                      detail: { platformId: 'hero-platform-1' },
                    }),
                  )
                }
                className="rounded border border-line px-2 py-1 text-secondary hover:text-foreground"
              >
                Reset to Hero
              </button>
            </div>
            <button
              type="button"
              aria-pressed={forceNitro}
              onClick={() => {
                const enabled = !forceNitro
                setForceNitro(enabled)
                window.dispatchEvent(
                  new CustomEvent('portfolio:force-nitro', {
                    detail: { enabled },
                  }),
                )
              }}
              className="rounded border border-cyan-500/70 px-2 py-1 text-left text-cyan-300"
            >
              {forceNitro ? 'Force Nitro: ON' : 'Force Nitro'}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={
                  telemetry?.flightState != null &&
                  telemetry.flightState !== 'GROUNDED'
                }
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('portfolio:flight-takeoff'),
                  )
                }
                className="rounded border border-cyan-500/70 px-2 py-1 text-cyan-300 disabled:opacity-40"
              >
                Takeoff
              </button>
              <button
                type="button"
                disabled={
                  telemetry?.flightState !== 'HOVERING' &&
                  telemetry?.flightState !== 'TAKEOFF'
                }
                onClick={() =>
                  window.dispatchEvent(new CustomEvent('portfolio:flight-land'))
                }
                className="rounded border border-cyan-500/70 px-2 py-1 text-cyan-300 disabled:opacity-40"
              >
                Land
              </button>
            </div>
            {telemetry && (
              <div className="text-[10px] text-muted">
                <div>
                  Active: {telemetry.platformId} ({telemetry.state})
                </div>
                <div>
                  Loops {telemetry.activeSimulationLoops} · transitions{' '}
                  {telemetry.transitionCount} · owner {telemetry.positionOwner}
                </div>
                <div>
                  Frame {telemetry.frameTimeMs?.toFixed(1)}ms · max step{' '}
                  {telemetry.largestFrameDisplacement?.toFixed(3)}u
                </div>
                <div>
                  Boosters: {telemetry.booster?.visible ? 'visible' : 'hidden'}{' '}
                  · {Math.round((telemetry.booster?.intensity ?? 0) * 100)}% ·{' '}
                  {JSON.stringify(telemetry.booster?.worldPositions ?? [])}
                </div>
                <div>
                  Scroll: {telemetry.scrollDirection ?? 'none'} ·{' '}
                  {(telemetry.scrollVelocity ?? 0).toFixed(0)} px/s · idle{' '}
                  {(telemetry.scrollInactiveMs ?? 0).toFixed(0)}ms
                </div>
                <div>
                  Flight: {telemetry.flightState ?? 'GROUNDED'} · Hover:{' '}
                  {(telemetry.hoverHeight ?? 0).toFixed(2)}u · Booster:{' '}
                  {Math.round((telemetry.boosterIntensity ?? 0) * 100)}%
                </div>
                <div>
                  Bounds: [{telemetry.minX.toFixed(2)},{' '}
                  {telemetry.maxX.toFixed(2)}]
                </div>
                {telemetry.supportLost && (
                  <div className="text-red-400">Support lost — paused</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      {enabled && (
        <div
          aria-hidden="true"
          data-robot-surface-debug-overlay=""
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
        >
          {surfaces.map((surface) => {
            const left = surface.docLeft - scrollX
            const top = surface.docTop - scrollY
            return (
              <div
                key={surface.id}
                style={{
                  position: 'fixed',
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${surface.pxWidth}px`,
                  height: '2px',
                  backgroundColor: '#22c55e',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    left: 0,
                    bottom: '4px',
                    whiteSpace: 'nowrap',
                    fontSize: '10px',
                    lineHeight: 1,
                    fontFamily: 'var(--font-mono)',
                    color: '#22c55e',
                    backgroundColor: 'rgba(10, 10, 10, 0.8)',
                    padding: '1px 4px',
                    borderRadius: '2px',
                  }}
                >
                  {surface.id} · {Math.round(surface.pxWidth)}px (
                  {surface.width.toFixed(2)}u)
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
