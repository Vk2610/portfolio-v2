export function mountCompanion(
  layer: HTMLElement,
  main: HTMLElement,
  signal: AbortSignal,
): Promise<(() => void) | undefined>
