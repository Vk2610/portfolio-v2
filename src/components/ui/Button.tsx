import type { ComponentProps } from 'react'
import './button.css'

const control =
  'control-target inline-flex cursor-pointer items-center justify-center gap-2 border px-4 font-medium'

const styles = {
  primary: 'primary-cta inline-flex rounded-sm',
  secondary: `${control} rounded-md border-line bg-background-secondary text-foreground hover:bg-hover hover:border-line-hover`,
}

function PrimaryFace({ children }: Pick<ComponentProps<'span'>, 'children'>) {
  return (
    <span className={`primary-cta-face ${control}`}>
      <span className="primary-cta-content inline-flex items-center gap-2">
        {children}
      </span>
    </span>
  )
}

export function Button({
  variant = 'primary',
  type = 'button',
  className = '',
  children,
  ...props
}: ComponentProps<'button'> & { variant?: keyof typeof styles }) {
  return (
    <button
      {...props}
      type={type}
      className={`${styles[variant]} disabled:pointer-events-none disabled:border-line-subtle disabled:bg-surface disabled:text-disabled ${className}`}
    >
      {variant === 'primary' ? <PrimaryFace>{children}</PrimaryFace> : children}
    </button>
  )
}

export function ButtonLink({
  variant = 'primary',
  className = '',
  children,
  ...props
}: ComponentProps<'a'> & { href: string; variant?: keyof typeof styles }) {
  return (
    <a {...props} className={`${styles[variant]} ${className}`}>
      {variant === 'primary' ? <PrimaryFace>{children}</PrimaryFace> : children}
    </a>
  )
}
