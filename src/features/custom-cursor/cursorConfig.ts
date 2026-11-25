export type CursorVariant =
  'default' | 'button' | 'nav' | 'heading' | 'text' | 'network'

export interface CursorVariantSpec {
  size: number
  isRing: boolean
  isSpotlight?: boolean
  hideGlobalCursor?: boolean
}

export const CURSOR_VARIANTS: Record<CursorVariant, CursorVariantSpec> = {
  default: { size: 6, isRing: false },
  button: { size: 42, isRing: true },
  nav: { size: 28, isRing: true },
  heading: { size: 48, isRing: false, isSpotlight: true },
  text: { size: 0, isRing: false, hideGlobalCursor: true },
  network: { size: 0, isRing: false, hideGlobalCursor: true },
}

const VALID_VARIANTS = new Set<string>(Object.keys(CURSOR_VARIANTS))

const TEXT_INPUT_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]), textarea, select, [contenteditable="true"]'

export const STATIC_TEXT_SELECTOR =
  'p, li, blockquote, pre, code, h1, h2, h3, h4, h5, h6, dt, dd, figcaption'

export interface CursorResolution {
  variant: CursorVariant
  textElement: Element | null
}

export function resolveCursorTarget(
  target: EventTarget | null,
): CursorResolution {
  if (!(target instanceof Element)) {
    return { variant: 'default', textElement: null }
  }

  const explicit = target.closest<HTMLElement>('[data-cursor]')
  if (explicit) {
    const value = explicit.dataset.cursor
    if (value && VALID_VARIANTS.has(value)) {
      const variant = value as CursorVariant
      return {
        variant,
        textElement: variant === 'heading' ? explicit : null,
      }
    }
  }

  if (target.closest(TEXT_INPUT_SELECTOR)) {
    return { variant: 'text', textElement: null }
  }

  if (target.closest('button, [role="button"], [role="tab"]')) {
    return { variant: 'button', textElement: null }
  }

  if (target.closest('a[href]')) {
    return { variant: 'nav', textElement: null }
  }

  const textEl = target.closest(STATIC_TEXT_SELECTOR)
  if (textEl) {
    return { variant: 'heading', textElement: textEl }
  }

  return { variant: 'default', textElement: null }
}

export function resolveCursorVariant(
  target: EventTarget | null,
): CursorVariant {
  return resolveCursorTarget(target).variant
}
