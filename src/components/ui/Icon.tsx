import type { LucideIcon } from 'lucide-react'

const sizes = { inline: 16, button: 18, standard: 24, featured: 32 }

export function Icon({
  icon: Glyph,
  size = 'standard',
}: {
  icon: LucideIcon
  size?: keyof typeof sizes
}) {
  return (
    <Glyph
      aria-hidden="true"
      focusable="false"
      size={sizes[size]}
      strokeWidth={1.5}
      className="shrink-0"
    />
  )
}
