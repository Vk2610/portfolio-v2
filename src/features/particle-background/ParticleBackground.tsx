import { useEffect, useRef } from 'react'
import { particleConfig } from './particle-config'
import { createParticleEngine } from './particle-engine'

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !particleConfig.enabled) return
    const engine = createParticleEngine(canvas)
    if (!engine) return

    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const updatePlayback = () =>
      engine.setPlayback(!document.hidden, motion?.matches ?? false)
    const resize = () => {
      const { width, height } = canvas.getBoundingClientRect()
      engine.resize(width, height, window.devicePixelRatio)
    }

    const sizes =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
    sizes?.observe(canvas)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', updatePlayback)
    motion?.addEventListener('change', updatePlayback)
    resize()
    updatePlayback()

    return () => {
      sizes?.disconnect()
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', updatePlayback)
      motion?.removeEventListener('change', updatePlayback)
      engine.destroy()
    }
  }, [])

  if (!particleConfig.enabled) return null

  return (
    <canvas
      ref={canvasRef}
      data-particle-background=""
      className="pointer-events-none fixed inset-0 -z-10 block size-full"
      aria-hidden="true"
    />
  )
}
