import { useEffect, useId, useRef, useState } from 'react'
import { DatabaseSearch } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/Tooltip'
import type { Technology } from '@/data/technologies'
import { loadTechnologyIcon } from '@/features/technology-network/network-svg-renderer'

export function TechnologyTile({ technology }: { technology: Technology }) {
  const icon = useRef<HTMLSpanElement>(null)
  const descriptionId = useId()
  const [open, setOpen] = useState(false)
  const openOnPress = useRef<boolean | null>(null)

  useEffect(() => {
    const host = icon.current
    if (!host) return
    if (technology.id === 'sql') return
    let active = true
    void loadTechnologyIcon(technology).then((source) => {
      if (!active || !source) return
      const svg = document.importNode(source, true)
      svg.setAttribute('width', '36')
      svg.setAttribute('height', '36')
      svg.setAttribute('focusable', 'false')
      host.replaceChildren(svg)
    })
    return () => {
      active = false
      host.replaceChildren()
    }
  }, [technology])

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-describedby={descriptionId}
          className="group flex h-20 w-full cursor-pointer flex-col items-center justify-center gap-2 px-1 text-secondary transition-colors duration-(--duration-normal) ease-in-out hover:text-foreground focus-visible:text-foreground focus-visible:outline-focus motion-reduce:transition-none"
          onPointerDownCapture={() => {
            // Radix closes an open tooltip on pointer-down before click fires.
            openOnPress.current = open
          }}
          onPointerCancel={() => {
            openOnPress.current = null
          }}
          onClick={(event) => {
            event.preventDefault()
            const wasOpen =
              event.detail > 0 ? (openOnPress.current ?? open) : open
            openOnPress.current = null
            setOpen(!wasOpen)
          }}
        >
          <span
            ref={icon}
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center fill-current transition-transform duration-(--duration-normal) ease-in-out motion-safe:group-hover:-translate-y-[3px] motion-reduce:transition-none [&_path[fill='#fafafa']]:fill-current [&_svg[fill='#fafafa']]:fill-current"
          >
            {technology.id === 'sql' && (
              <DatabaseSearch
                aria-hidden="true"
                className="size-9 fill-none stroke-current stroke-[1.5]"
                data-sql-database-search=""
              />
            )}
          </span>
          <span className="max-w-full text-center text-sm leading-tight">
            {technology.label}
          </span>
        </button>
      </TooltipTrigger>
      <span id={descriptionId} className="sr-only">
        {technology.description}
      </span>
      <TooltipContent aria-label={technology.description} collisionPadding={12}>
        <strong className="block font-medium">{technology.label}</strong>
        {technology.description}
      </TooltipContent>
    </Tooltip>
  )
}
