import type { ComponentProps } from 'react'

export function Container({ className = '', ...props }: ComponentProps<'div'>) {
  return <div {...props} className={`content-container ${className}`} />
}
