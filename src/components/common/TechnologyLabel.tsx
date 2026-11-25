import type { ComponentProps } from 'react'

export function TechnologyLabel({
  className = '',
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      {...props}
      className={`type-mono inline-block rounded border border-line-subtle bg-background-secondary px-2 py-1 text-secondary ${className}`}
    />
  )
}
