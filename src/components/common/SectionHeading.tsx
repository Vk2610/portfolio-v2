import type { ComponentProps } from 'react'

export function SectionHeading({
  number,
  as: Heading = 'h2',
  children,
  className = '',
  ...props
}: ComponentProps<'h2'> & { number: string; as?: 'h2' | 'h3' }) {
  return (
    <Heading
      {...props}
      className={`flex items-baseline gap-3 ${Heading === 'h2' ? 'type-h2' : 'type-h3'} ${className}`}
    >
      <span aria-hidden="true" className="type-mono shrink-0 text-secondary">
        {number}
      </span>
      <span>{children}</span>
    </Heading>
  )
}
