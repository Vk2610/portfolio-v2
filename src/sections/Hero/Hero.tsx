import type { ReactNode } from 'react'
import { ArrowDownRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { staggeredEntrance } from '@/animations/variants'
import { Section } from '@/components/layout/Section'
import { ButtonLink } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { TextLink } from '@/components/ui/TextLink'
import { profile } from '@/data/profile'

export function Hero({ network }: { network?: ReactNode }) {
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('fade-up', reduced)

  return (
    <Section aria-labelledby="hero-title">
      <div className="grid items-center gap-8 tablet:grid-cols-[0.9fr_1.1fr] tablet:gap-8 desktop:grid-cols-[0.4fr_0.6fr] desktop:gap-7">
        <div className="min-w-0">
          <p className="type-mono mb-4 text-secondary">01 / INTRO</p>
          <h1 id="hero-title" className="type-hero" data-cursor="heading">
            {profile.name}
          </h1>
          <p className="type-h3 mt-4 text-secondary">{profile.title}</p>
          <motion.div
            variants={group}
            initial={reduced ? false : 'hidden'}
            animate="visible"
          >
            <motion.p
              variants={item}
              className="type-body-large mt-5 max-w-[38ch] text-secondary"
            >
              {profile.description}
            </motion.p>
            <motion.div
              variants={item}
              className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2"
            >
              <ButtonLink href="#work">
                View Projects <Icon icon={ArrowDownRight} size="button" />
              </ButtonLink>
              <TextLink href={profile.github}>GitHub</TextLink>
              <TextLink href={profile.linkedin}>LinkedIn</TextLink>
            </motion.div>
          </motion.div>
        </div>
        <div
          className="relative h-[clamp(16rem,62vw,26rem)] min-w-0 desktop:h-[clamp(26rem,38vw,34rem)]"
          aria-hidden={network == null ? true : undefined}
        >
          {network}
        </div>
      </div>
    </Section>
  )
}
