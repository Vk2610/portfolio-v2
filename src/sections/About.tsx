import {
  DecodeIdentifier,
  RevealHeading,
} from '@/components/common/TypographyEntrance'
import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { useCountUp } from '@/animations/useCountUp'
import { SectionDivider } from '@/components/common/SectionDivider'
import { Section } from '@/components/layout/Section'
import { technologies } from '@/data/technologies'
import { profile } from '@/data/profile'

const statistics = [
  { value: '10+', label: 'Projects built' },
  { value: '01', label: 'Internship' },
  { value: String(technologies.length), label: 'Technologies showcased' },
]
const statisticValues = statistics.map(({ value }) => value)

export function About() {
  const ref = useRef<HTMLDivElement>(null)
  const statisticsRef = useRef<HTMLDListElement>(null)
  const entered = useInView(ref, { once: true, amount: 0.2 })
  const statisticsEntered = useInView(statisticsRef, {
    once: true,
    amount: 0.2,
  })
  const reduced = useReducedMotion() ?? false
  const countRefs = useCountUp(statisticValues, statisticsEntered && !reduced)
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
        <div>
          <DecodeIdentifier className="type-mono text-muted">
            02 / ABOUT ME
          </DecodeIdentifier>
          <RevealHeading
            id="about-heading"
            className="type-h2 mt-7 max-w-[12ch]"
          >
            A developer across the stack.
          </RevealHeading>
        </div>
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
          ref={statisticsRef}
          variants={group}
          initial={reduced ? false : 'hidden'}
          animate={reveal}
          className="grid grid-cols-3 gap-4 py-7 tablet:gap-8 tablet:py-9"
        >
          {statistics.map(({ value, label }, index) => (
            <motion.div key={label} variants={item} className="min-w-0">
              <dt className="type-h2 tabular-nums">
                <span className="inline-grid">
                  <span className="col-start-1 row-start-1 select-none opacity-0">
                    {value}
                  </span>
                  <span
                    aria-hidden="true"
                    className="col-start-1 row-start-1"
                    ref={(element) => {
                      countRefs.current[index] = element
                    }}
                  >
                    {value}
                  </span>
                </span>
              </dt>
              <dd className="type-caption mt-2 text-muted">{label}</dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </Section>
  )
}
