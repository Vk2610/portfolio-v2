import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { SectionDivider } from '@/components/common/SectionDivider'
import { Section } from '@/components/layout/Section'
import { profile } from '@/data/profile'

const statusItems = [
  { label: 'BASED IN', value: profile.location },
  { label: 'SPECIALIZATION', value: profile.specialization },
  { label: 'FOCUS', value: profile.focus },
]

export function ProfessionalStatus() {
  const ref = useRef<HTMLDivElement>(null)
  const entered = useInView(ref, { once: true, amount: 0.35 })
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('fade-up', reduced)

  return (
    <Section aria-label="Professional status" className="py-8 tablet:py-10">
      <SectionDivider />
      <motion.div
        ref={ref}
        variants={group}
        initial={reduced ? false : 'hidden'}
        animate={reduced || entered ? 'visible' : 'hidden'}
        className="grid gap-7 py-8 tablet:grid-cols-3 tablet:gap-8 tablet:py-9"
      >
        {statusItems.map(({ label, value }) => (
          <motion.div key={label} variants={item} className="min-w-0">
            <p className="type-mono text-muted">{label}</p>
            <p className="mt-2 font-medium text-foreground">{value}</p>
          </motion.div>
        ))}
      </motion.div>
      <SectionDivider />
    </Section>
  )
}
