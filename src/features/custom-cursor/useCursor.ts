import { useEffect, useRef, useState } from 'react'
import {
  CURSOR_VARIANTS,
  resolveCursorTarget,
  type CursorVariant,
} from './cursorConfig'

const SPOTLIGHT_RADIUS = 24

export function isCustomCursorSupported(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false
  }
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  return finePointer.matches && !reducedMotion.matches
}

export function useCursor() {
  const rootRef = useRef<HTMLDivElement>(null)
  const shapeRef = useRef<HTMLDivElement>(null)
  const spotlightLayerRef = useRef<HTMLDivElement>(null)
  const [supported, setSupported] = useState<boolean>(() =>
    isCustomCursorSupported(),
  )

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return
    }

    const finePointerQuery = window.matchMedia(
      '(hover: hover) and (pointer: fine)',
    )
    const reducedMotionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    )

    const updateSupport = () => {
      setSupported(finePointerQuery.matches && !reducedMotionQuery.matches)
    }

    finePointerQuery.addEventListener('change', updateSupport)
    reducedMotionQuery.addEventListener('change', updateSupport)

    return () => {
      finePointerQuery.removeEventListener('change', updateSupport)
      reducedMotionQuery.removeEventListener('change', updateSupport)
    }
  }, [])

  useEffect(() => {
    const html = document.documentElement
    if (!supported) {
      html.removeAttribute('data-custom-cursor')
      html.removeAttribute('data-cursor-native')
      return
    }

    html.setAttribute('data-custom-cursor', 'active')

    let currentVariant: CursorVariant = 'default'
    let activeTextElement: Element | null = null
    let activeClone: HTMLElement | null = null
    let activeRect: DOMRect | null = null
    let isVisible = false
    let isPressed = false
    let lastX = 0
    let lastY = 0

    const clearSpotlightClone = () => {
      if (activeClone && activeClone.parentNode) {
        activeClone.parentNode.removeChild(activeClone)
      }
      activeClone = null
      activeTextElement = null
      activeRect = null
    }

    const syncSpotlightClone = (el: Element) => {
      const layer = spotlightLayerRef.current
      if (!layer) return

      if (activeTextElement !== el) {
        clearSpotlightClone()
        activeTextElement = el
        const rect = el.getBoundingClientRect()
        activeRect = rect
        const computed = window.getComputedStyle(el)

        const clone = el.cloneNode(true) as HTMLElement
        clone.removeAttribute('id')
        clone.setAttribute('aria-hidden', 'true')
        clone.classList.add('custom-cursor-spotlight-clone')
        clone.style.position = 'fixed'
        clone.style.top = `${rect.top}px`
        clone.style.left = `${rect.left}px`
        clone.style.width = `${rect.width}px`
        clone.style.height = `${rect.height}px`
        clone.style.margin = '0'
        clone.style.padding = computed.padding
        clone.style.fontFamily = computed.fontFamily
        clone.style.fontSize = computed.fontSize
        clone.style.fontWeight = computed.fontWeight
        clone.style.letterSpacing = computed.letterSpacing
        clone.style.lineHeight = computed.lineHeight
        clone.style.textAlign = computed.textAlign
        clone.style.textTransform = computed.textTransform
        clone.style.whiteSpace = computed.whiteSpace
        clone.style.wordBreak = computed.wordBreak
        clone.style.overflowWrap = computed.overflowWrap

        layer.appendChild(clone)
        activeClone = clone
      }

      if (activeClone && activeRect) {
        const radius = SPOTLIGHT_RADIUS * (isPressed ? 0.7 : 1)
        const localX = lastX - activeRect.left
        const localY = lastY - activeRect.top
        activeClone.style.clipPath = `circle(${radius}px at ${localX}px ${localY}px)`
      }
    }

    const applyState = (
      variant: CursorVariant,
      visible: boolean,
      pressed: boolean,
    ) => {
      const root = rootRef.current
      const shape = shapeRef.current
      const spec = CURSOR_VARIANTS[variant]
      const hideGlobal = Boolean(spec.hideGlobalCursor)
      const robotActive = html.hasAttribute('data-cursor-robot')
      const showGlobal = visible && !hideGlobal && !robotActive

      if (hideGlobal) {
        html.setAttribute('data-cursor-native', 'true')
      } else {
        html.removeAttribute('data-cursor-native')
      }

      if (root) {
        root.dataset.visible = showGlobal ? 'true' : 'false'
        root.dataset.variant = variant
        root.dataset.pressed = pressed ? 'true' : 'false'
      }
      if (shape) {
        shape.dataset.variant = variant
      }

      if (!showGlobal || variant !== 'heading') {
        clearSpotlightClone()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (
        event.pointerType &&
        event.pointerType !== 'mouse' &&
        event.pointerType !== 'pen'
      ) {
        return
      }
      lastX = event.clientX
      lastY = event.clientY
      const root = rootRef.current
      if (root) {
        root.style.transform = `translate3d(${lastX}px, ${lastY}px, 0)`
      }
      isVisible = true
      const resolved = resolveCursorTarget(event.target)
      currentVariant = resolved.variant

      if (resolved.variant === 'heading' && resolved.textElement) {
        applyState(currentVariant, isVisible, isPressed)
        syncSpotlightClone(resolved.textElement)
      } else {
        applyState(currentVariant, isVisible, isPressed)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        event.pointerType &&
        event.pointerType !== 'mouse' &&
        event.pointerType !== 'pen'
      ) {
        return
      }
      isPressed = true
      applyState(currentVariant, isVisible, isPressed)
      if (currentVariant === 'heading' && activeTextElement) {
        syncSpotlightClone(activeTextElement)
      }
    }

    const handlePointerUp = () => {
      isPressed = false
      applyState(currentVariant, isVisible, isPressed)
      if (currentVariant === 'heading' && activeTextElement) {
        syncSpotlightClone(activeTextElement)
      }
    }

    const handleHide = () => {
      isVisible = false
      isPressed = false
      applyState(currentVariant, false, false)
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleHide()
      }
    }

    const handleRobotCursorChange = () => {
      applyState(currentVariant, isVisible, isPressed)
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    window.addEventListener('pointerdown', handlePointerDown, { passive: true })
    window.addEventListener('pointerup', handlePointerUp, { passive: true })
    window.addEventListener('pointercancel', handleHide, { passive: true })
    window.addEventListener('blur', handleHide)
    window.addEventListener('portfolio:robot-cursor', handleRobotCursorChange)
    document.documentElement.addEventListener('pointerleave', handleHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearSpotlightClone()
      html.removeAttribute('data-custom-cursor')
      html.removeAttribute('data-cursor-native')
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handleHide)
      window.removeEventListener('blur', handleHide)
      window.removeEventListener(
        'portfolio:robot-cursor',
        handleRobotCursorChange,
      )
      document.documentElement.removeEventListener('pointerleave', handleHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supported])

  return { rootRef, shapeRef, spotlightLayerRef, supported }
}
