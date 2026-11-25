import type { ComponentProps, Ref } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Button } from './Button'
import { Icon } from './Icon'

export function IconButton({
  label,
  icon,
  ref,
  ...props
}: Omit<ComponentProps<'button'>, 'children' | 'aria-label' | 'ref'> & {
  label: string
  icon: LucideIcon
  ref?: Ref<HTMLButtonElement>
}) {
  return (
    <Button
      {...props}
      ref={ref}
      aria-label={label}
      variant="secondary"
      className={`w-[var(--target-size)] px-0 ${props.className ?? ''}`}
    >
      <Icon icon={icon} size="button" />
    </Button>
  )
}
