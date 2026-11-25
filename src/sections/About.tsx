import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { SectionDivider } from '@/components/common/SectionDivider'
import { Section } from '@/components/layout/Section'
import { technologies } from '@/data/technologies'
import { profile } from '@/data/profile'

const statistics = [
  { value: '10+', label: 'Projects built' },
  { value: '01', label: 'Internship' },
  { value: String(technologies.length), label: 'Technologies showcased' },
]

export function About() {
  const ref = useRef<HTMLDivElement>(null)
  const entered = useInView(ref, { once: true, amount: 0.2 })
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('fade-up', reduced)
  const reveal = reduced || entered ? 'visible' : 'hidden'

  return (
    <Section id="about" aria-labelledby="about-heading">
      <motion.div
        ref={ref}
        variants={group}
        initial={reduced ? false : 'hidden'}
        animate={reveal}
        className="grid gap-8 desktop:grid-cols-[0.8fr_1.2fr] desktop:gap-16"
      >
        <motion.div variants={item}>
          <p className="type-mono whitespace-nowrap text-muted">
            02 / ABOUT ME
          </p>
          <h2 id="about-heading" className="type-h2 mt-7 max-w-[12ch]">
            A developer across the stack.
          </h2>
        </motion.div>
        <motion.div variants={group} className="space-y-5 desktop:pt-1">
          {profile.about.map((paragraph) => (
            <motion.p
              key={paragraph}
              variants={item}
              className="type-body max-w-[62ch] text-secondary"
            >
              {paragraph}
            </motion.p>
          ))}
        </motion.div>
      </motion.div>

      <div className="mt-12 tablet:mt-16">
        <SectionDivider />
        <motion.dl
          variants={group}
          initial={reduced ? false : 'hidden'}
          animate={reveal}
          className="grid grid-cols-3 gap-4 py-7 tablet:gap-8 tablet:py-9"
        >
          {statistics.map(({ value, label }) => (
            <motion.div key={label} variants={item} className="min-w-0">
              <dt className="type-h2">{value}</dt>
              <dd className="type-caption mt-2 text-muted">{label}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </Section>
  )
}
