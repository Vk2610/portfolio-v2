import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { SectionDivider } from '@/components/common/SectionDivider'
import { TechnologyTile } from '@/components/common/TechnologyTile'
import { Section } from '@/components/layout/Section'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { technologyCategories } from '@/data/technology-categories'

function TechnologyCategory({
  category,
}: {
  category: (typeof technologyCategories)[number]
}) {
  const ref = useRef<HTMLUListElement>(null)
  const entered = useInView(ref, { once: true, amount: 0.15 })
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('tile', reduced)
  const headingId = `stack-${category.id}`

  return (
    <div className="grid gap-4 py-6 desktop:grid-cols-[12rem_minmax(0,1fr)] desktop:gap-8">
      <h3 id={headingId} className="type-h3">
        {category.label}
      </h3>
      <motion.ul
        ref={ref}
        aria-labelledby={headingId}
        className="grid grid-cols-3 gap-2 tablet:grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] tablet:gap-3"
        variants={group}
        initial={reduced ? false : 'hidden'}
        animate={entered || reduced ? 'visible' : 'hidden'}
      >
        {category.technologies.map((technology) => (
          <motion.li
            key={technology.id}
            variants={item}
            className="min-w-0 focus-within:opacity-100! focus-within:transform-none!"
          >
            <TechnologyTile technology={technology} />
          </motion.li>
        ))}
      </motion.ul>
    </div>
  )
}

const technologyCount = technologyCategories.reduce(
  (count, category) => count + category.technologies.length,
  0,
)

export function TechnologyStack() {
  return (
    <Section
      id="stack"
      aria-labelledby="stack-heading"
      className="scroll-mt-16"
    >
      <p className="type-mono whitespace-nowrap text-muted">03 / TECHNOLOGY</p>
      <h2 id="stack-heading" className="type-h2 mt-7">
        My toolkit.
      </h2>
      <p className="mt-4 text-secondary">
        Technologies I work with to build modern, scalable applications.
      </p>
      <TooltipProvider skipDelayDuration={0}>
        <div className="mt-10">
          {technologyCategories.map((category) => (
            <div key={category.id}>
              <SectionDivider />
              <TechnologyCategory category={category} />
            </div>
          ))}
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
