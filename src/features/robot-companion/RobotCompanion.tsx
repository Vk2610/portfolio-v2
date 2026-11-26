import { useEffect, useRef } from 'react'
import './robot-companion.css'

export function RobotCompanion() {
  const layer = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = layer.current
    const main = document.querySelector<HTMLElement>('main#top')
    if (!container || !main || !window.WebGL2RenderingContext) return

    const abort = new AbortController()
    let dispose: (() => void) | undefined
    let loading = false
    const load = async () => {
      if (loading || abort.signal.aborted) return
      loading = true
      observer.disconnect()
      try {
        const { mountCompanion } = await import('./companion-scene.js')
        if (!abort.signal.aborted) {
          const stop = await mountCompanion(container, main, abort.signal)
          if (abort.signal.aborted) stop?.()
          else dispose = stop
        }
      } catch (error) {
        if (!abort.signal.aborted && import.meta.env.DEV) {
          console.warn('H1 companion could not start.', error)
        }
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void load()
      },
      { rootMargin: '650px 0px' },
    )
    // Keep the WebGL and physics chunk off the initial navigation path.
    const sections = [...main.querySelectorAll(':scope > section')].slice(1)
    if (sections.length)
      sections.forEach((section) => observer.observe(section))
    else void load()

    return () => {
      abort.abort()
      observer.disconnect()
      dispose?.()
    }
  }, [])

  return <div ref={layer} className="robot-companion" aria-hidden="true" />
}
