import { motion, useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { staggeredEntrance } from '@/animations/variants'
import { SectionDivider } from '@/components/common/SectionDivider'
import { Section } from '@/components/layout/Section'
import { experience } from '@/data/experience'

export function Experience() {
  const ref = useRef<HTMLDivElement>(null)
  const entered = useInView(ref, { once: true, amount: 0.15 })
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('fade-up', reduced)
  const visible = reduced || entered ? 'visible' : 'hidden'

  return (
    <Section
      id="experience"
      aria-labelledby="experience-heading"
      className="scroll-mt-16 py-16 tablet:py-20"
    >
      <p className="type-mono whitespace-nowrap text-muted">04 / EXPERIENCE</p>
      <h2 id="experience-heading" className="type-h2 mt-7">
        Where I've worked.
      </h2>
      <div className="mt-8">
        <SectionDivider />
        {experience.map((entry) => (
          <article ref={ref} key={entry.company} className="py-6 tablet:py-8">
            <motion.div
              variants={group}
              initial={reduced ? false : 'hidden'}
              animate={visible}
              className="grid gap-5 tablet:grid-cols-[1fr_auto] tablet:items-start"
            >
              <motion.div variants={item}>
                <h3 className="text-[22px] font-semibold leading-tight tablet:text-2xl desktop:text-[28px]">
                  {entry.company}
                </h3>
                <p className="mt-2 text-base text-secondary tablet:text-lg">
                  {entry.role}
                </p>
              </motion.div>
              <motion.div
                variants={item}
                className="hidden text-right tablet:block"
              >
                <p className="type-mono text-secondary">
                  {entry.startDate} – {entry.endDate}
                </p>
                <p className="type-mono mt-2 text-muted">{entry.location}</p>
              </motion.div>
              <motion.div
                variants={item}
                className="grid gap-3 tablet:col-span-2"
              >
                <p className="type-body max-w-[78ch] text-secondary">
                  {entry.description}
                </p>
                <ul
                  aria-label="Technologies used"
                  className="flex flex-wrap gap-x-5 gap-y-2"
                >
                  {entry.technologies.map((technology) => (
                    <motion.li
                      key={technology}
                      variants={item}
                      className="type-mono text-secondary"
                    >
                      {technology}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>

            <div className="mt-6 tablet:hidden">
              <p className="type-mono text-secondary">
                {entry.startDate} – {entry.endDate}
              </p>
              <p className="type-mono mt-2 text-muted">{entry.location}</p>
            </div>
          </article>
        ))}
        <SectionDivider />
      </div>
    </Section>
  )
}
