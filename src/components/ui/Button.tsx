import type { ComponentProps } from 'react'

const control =
  'control-target inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border px-4 font-medium'

const styles = {
  primary:
    'border-inverse bg-inverse text-on-inverse hover:bg-focus hover:border-focus',
  secondary:
    'border-line bg-background-secondary text-foreground hover:bg-hover hover:border-line-hover',
}

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof styles }) {
  return (
    <button
      {...props}
      type={type}
      className={`${control} disabled:pointer-events-none disabled:border-line-subtle disabled:bg-surface disabled:text-disabled ${styles[variant]} ${className}`}
    />
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  ...props
}: ComponentProps<'a'> & { href: string; variant?: keyof typeof styles }) {
  return (
    <a {...props} className={`${control} ${styles[variant]} ${className}`} />
  )
}
