import type { ComponentProps } from 'react'

export function TextLink({
  className = '',
  ...props
}: ComponentProps<'a'> & { href: string }) {
  return (
    <a
      {...props}
      className={`underline-reveal inline-flex min-h-(--target-size) min-w-(--target-size) items-center font-medium text-secondary hover:text-foreground focus-visible:text-foreground ${className}`}
    />
  )
}
