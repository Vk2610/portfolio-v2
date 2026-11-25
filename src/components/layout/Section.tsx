import type { ComponentProps } from 'react'
import { Container } from './Container'

export function Section({
  children,
  className = '',
  ...props
}: ComponentProps<'section'>) {
  return (
    <section {...props} className={`section-space ${className}`}>
      <Container>{children}</Container>
    </section>
  )
}
