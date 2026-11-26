import { useEffect, useState } from 'react'
import {
  collectDomSurfaces,
  domToWorldSurface,
  resolveHeroWorldOrigin,
  type WorldSurface,
} from './surface-registry'

export function SurfaceDebugOverlay() {
  const [enabled, setEnabled] = useState(false)
  const [surfaces, setSurfaces] = useState<WorldSurface[]>([])

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
    }

    const schedule = () => {
      if (!raf) raf = window.requestAnimationFrame(refresh)
    }

    const observer = new MutationObserver(schedule)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
    })
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, { passive: true })
    schedule()

    return () => {
      if (raf) window.cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule)
    }
  }, [enabled])

  const scrollX = typeof window !== 'undefined' ? window.scrollX : 0
  const scrollY = typeof window !== 'undefined' ? window.scrollY : 0

  return (
    <>
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        data-robot-surface-debug-toggle=""
        className="fixed bottom-4 left-4 z-50 rounded border border-emerald-500/70 bg-background/90 px-2.5 py-1.5 font-mono text-xs text-emerald-400"
      >
        {enabled ? `Surfaces: ON (${surfaces.length})` : 'Surfaces: OFF'}
      </button>
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
