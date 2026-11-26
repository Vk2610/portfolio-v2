import * as Primitive from '@radix-ui/react-tooltip'
import type { ComponentProps } from 'react'
import { motionMilliseconds } from '@/animations/transitions'

export function TooltipProvider({
  delayDuration,
  ...props
}: ComponentProps<typeof Primitive.Provider>) {
  return (
    <Primitive.Provider
      {...props}
      delayDuration={delayDuration ?? motionMilliseconds('--tooltip-delay')}
    />
  )
}

export const Tooltip = Primitive.Root
export const TooltipTrigger = Primitive.Trigger

export function TooltipContent({
  className = '',
  sideOffset = 8,
  variant = 'default',
  ...props
}: ComponentProps<typeof Primitive.Content> & {
  variant?: 'default' | 'technology'
}) {
  return (
    <Primitive.Portal>
      <Primitive.Content
        {...props}
        sideOffset={sideOffset}
        className={`${variant === 'technology' ? 'technology-metadata' : 'tooltip-reveal type-caption z-50 max-w-[min(16rem,var(--radix-tooltip-content-available-width))] rounded-md border border-line bg-surface px-3 py-2 text-foreground'} ${className}`}
      />
    </Primitive.Portal>
  )
}
