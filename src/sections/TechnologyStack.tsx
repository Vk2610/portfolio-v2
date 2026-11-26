import {
  DecodeIdentifier,
  RevealHeading,
} from '@/components/common/TypographyEntrance'
import {
  AnimatePresence,
  motion,
  useIsPresent,
  useReducedMotion,
} from 'motion/react'
import { useState } from 'react'
import { motionMilliseconds } from '@/animations/transitions'
import { staggeredEntrance } from '@/animations/variants'
import { SectionDivider } from '@/components/common/SectionDivider'
import { TechnologyTile } from '@/components/common/TechnologyTile'
import { Section } from '@/components/layout/Section'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { technologyCategories } from '@/data/technology-categories'
import type { TechnologyId } from '@/data/technologies'

function TechnologyGrid({
  category,
  reduced,
}: {
  category: (typeof technologyCategories)[number]
  reduced: boolean
}) {
  const present = useIsPresent()
  const { group, item } = staggeredEntrance('tile', reduced)
  const [hovered, setHovered] = useState<TechnologyId | null>(null)
  const [open, setOpen] = useState<TechnologyId | null>(null)
  const emphasized = hovered ?? open

  return (
    <motion.div
      inert={!present}
      aria-hidden={!present || undefined}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0 }}
      exit={
        reduced
          ? undefined
          : {
              opacity: 0,
              transition: {
                duration: motionMilliseconds('--duration-fast') / 1000,
              },
            }
      }
    >
      <motion.ul
        aria-labelledby="technology-category-heading"
        className="technology-grid grid grid-cols-3 content-start justify-items-center gap-x-3 gap-y-8 tablet:grid-cols-4 desktop:grid-cols-8"
        data-group-active={emphasized !== null}
        variants={group}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        onPointerLeave={() => setHovered(null)}
      >
        {category.technologies.map((technology) => (
          <motion.li
            key={technology.id}
            variants={item}
            className="w-full min-w-0"
          >
            <TechnologyTile
              technology={technology}
              present={present}
              open={present && open === technology.id}
              emphasis={
                emphasized === null
                  ? 'normal'
                  : emphasized === technology.id
                    ? 'active'
                    : 'dimmed'
              }
              onHover={() => {
                setHovered(technology.id)
                setOpen((previous) =>
                  previous === technology.id ? previous : null,
                )
              }}
              onOpenChange={(next) => {
                if (!present) return
                setOpen((previous) =>
                  next
                    ? technology.id
                    : previous === technology.id
                      ? null
                      : previous,
                )
              }}
            />
          </motion.li>
        ))}
      </motion.ul>
    </motion.div>
  )
}

const technologyCount = technologyCategories.reduce(
  (count, category) => count + category.technologies.length,
  0,
)

export function TechnologyStack() {
  const [selectedId, setSelectedId] = useState(technologyCategories[0].id)
  const reduced = useReducedMotion() ?? false
  const selected =
    technologyCategories.find(({ id }) => id === selectedId) ??
    technologyCategories[0]
  const categoryCount = selected.technologies.length

  return (
    <Section
      id="stack"
      aria-labelledby="stack-heading"
      className="scroll-mt-16"
    >
      <DecodeIdentifier className="type-mono text-muted">
        03 / TECHNOLOGY
      </DecodeIdentifier>
      <RevealHeading id="stack-heading" className="type-h2 mt-7">
        My toolkit.
      </RevealHeading>
      <p className="mt-4 text-secondary">
        Technologies I work with to build modern, scalable applications.
      </p>
      <TooltipProvider delayDuration={200} skipDelayDuration={0}>
        <div className="mt-10">
          <SectionDivider />
          <div
            role="tablist"
            aria-label="Technology categories"
            className="grid grid-cols-6 gap-x-2 gap-y-1 tablet:grid-cols-5 tablet:gap-0"
          >
            {technologyCategories.map((category, index) => {
              const mobilePlacement =
                index === 3
                  ? 'col-span-2 col-start-2 tablet:col-span-1 tablet:col-start-auto'
                  : index === 4
                    ? 'col-span-2 col-start-4 tablet:col-span-1 tablet:col-start-auto'
                    : 'col-span-2 tablet:col-span-1'
              return (
                <button
                  key={category.id}
                  type="button"
                  role="tab"
                  id={`technology-tab-${category.id}`}
                  aria-controls="technology-category-panel"
                  aria-selected={category.id === selected.id}
                  tabIndex={category.id === selected.id ? 0 : -1}
                  className={`underline-reveal inline-flex min-h-(--target-size) min-w-0 cursor-pointer items-center justify-center whitespace-nowrap px-1 text-xs font-medium text-secondary hover:text-foreground focus-visible:text-foreground aria-selected:text-foreground tablet:px-0 tablet:text-base ${mobilePlacement}`}
                  onClick={() => setSelectedId(category.id)}
                  onKeyDown={(event) => {
                    const last = technologyCategories.length - 1
                    const destinations: Partial<Record<string, number>> = {
                      ArrowLeft: index === 0 ? last : index - 1,
                      ArrowRight: index === last ? 0 : index + 1,
                      Home: 0,
                      End: last,
                    }
                    const nextIndex = destinations[event.key]
                    if (nextIndex === undefined) return
                    event.preventDefault()
                    const next = technologyCategories[nextIndex]
                    setSelectedId(next.id)
                    document
                      .getElementById(`technology-tab-${next.id}`)
                      ?.focus()
                  }}
                >
                  <span data-underline-label>{category.label}</span>
                </button>
              )
            })}
          </div>
          <div
            id="technology-category-panel"
            role="tabpanel"
            aria-labelledby={`technology-tab-${selected.id}`}
            className="mt-8 flex min-h-[22rem] flex-col tablet:min-h-[15rem] desktop:min-h-[10rem]"
          >
            <div className="mb-5 flex items-baseline justify-between gap-4">
              <span id="technology-category-heading" className="sr-only">
                {selected.label}
              </span>
              <span className="type-mono text-muted">
                {categoryCount} TECHNOLOGIES
              </span>
            </div>
            <AnimatePresence mode={reduced ? 'sync' : 'wait'} initial={false}>
              <TechnologyGrid
                key={selected.id}
                category={selected}
                reduced={reduced}
              />
            </AnimatePresence>
          </div>
        </div>
      </TooltipProvider>
      <SectionDivider />
      <p className="type-mono mt-6 text-muted">
        {technologyCount} TECHNOLOGIES /{' '}
        {String(technologyCategories.length).padStart(2, '0')} CATEGORIES
      </p>
    </Section>
  )
}
