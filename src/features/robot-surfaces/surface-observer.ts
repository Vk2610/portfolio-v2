import {
  collectDomSurfaces,
  domToWorldSurface,
  resolveHeroWorldOrigin,
  type WorldSurface,
  type WorldCoordinateOrigin,
} from './surface-registry'

export function observePortfolioSurfaces({
  getViewHeightWorld,
  getWorldOrigin,
  onSurfacesChange,
}: {
  getViewHeightWorld: () => number
  getWorldOrigin?: () => WorldCoordinateOrigin | null
  onSurfacesChange: (surfaces: WorldSurface[]) => void
}): () => void {
  let scheduled = 0
  let disposed = false

  function measure() {
    scheduled = 0
    if (disposed) return
    const heroHost = document.querySelector('[data-hero-robot]')
    if (!heroHost) {
      onSurfacesChange([])
      return
    }
    const origin = getWorldOrigin
      ? getWorldOrigin()
      : resolveHeroWorldOrigin(heroHost, getViewHeightWorld())
    if (!origin) return

    const domSurfaces = collectDomSurfaces(document)
    const worldSurfaces = domSurfaces.map((s) => domToWorldSurface(s, origin))
    onSurfacesChange(worldSurfaces)
  }

  function scheduleMeasure() {
    if (disposed || scheduled) return
    scheduled = window.requestAnimationFrame(measure)
  }

  const resizeObserver =
    typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleMeasure)
  resizeObserver?.observe(document.documentElement)

  const mutationObserver =
    typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver((records) => {
          if (
            records.some(
              ({ target }) =>
                target instanceof Element &&
                target.closest('main, [data-hero-robot]'),
            )
          )
            scheduleMeasure()
        })
  mutationObserver?.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'data-robot-surface',
      'data-robot-surface-edge',
      'inert',
      'aria-hidden',
      'class',
      'style',
    ],
  })

  window.addEventListener('resize', scheduleMeasure)
  document.addEventListener('transitionend', scheduleMeasure)
  document.addEventListener('animationend', scheduleMeasure)
  void document.fonts?.ready?.then(scheduleMeasure)

  scheduleMeasure()

  return () => {
    disposed = true
    if (scheduled) window.cancelAnimationFrame(scheduled)
    resizeObserver?.disconnect()
    mutationObserver?.disconnect()
    window.removeEventListener('resize', scheduleMeasure)
    document.removeEventListener('transitionend', scheduleMeasure)
    document.removeEventListener('animationend', scheduleMeasure)
  }
}
