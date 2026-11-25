import { Info } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { staggeredEntrance } from './animations/variants'
import { Section } from './components/layout/Section'
import { Button } from './components/ui/Button'
import { Icon } from './components/ui/Icon'
import { IconButton } from './components/ui/IconButton'
import { TextLink } from './components/ui/TextLink'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './components/ui/Tooltip'
import { SectionHeading } from './components/common/SectionHeading'
import { SectionDivider } from './components/common/SectionDivider'
import { TechnologyLabel } from './components/common/TechnologyLabel'

const swatches = [
  ['Background', 'bg-background'],
  ['Secondary background', 'bg-background-secondary'],
  ['Surface', 'bg-surface'],
  ['Hover', 'bg-hover'],
  ['Inverse', 'bg-inverse'],
  ['Secondary text', 'bg-secondary'],
  ['Muted text', 'bg-muted'],
  ['Disabled', 'bg-disabled'],
  ['Subtle border', 'bg-line-subtle'],
  ['Border', 'bg-line'],
  ['Hover border', 'bg-line-hover'],
  ['Focus', 'bg-focus'],
]

export default function DesignSystemPreview() {
  const reduced = useReducedMotion() ?? false
  return (
    <main>
      <Section>
        <h1 className="type-hero">Design system preview</h1>
        <div className="mt-8 grid gap-3">
          <p className="type-h1">Heading one</p>
          <p className="type-h2">Heading two</p>
          <p className="type-h3">Heading three</p>
          <p className="type-body-large">Large body</p>
          <p className="type-body">Body</p>
          <p className="type-caption">Caption</p>
          <p className="type-mono">Technical metadata</p>
        </div>
      </Section>
      <Section>
        <SectionDivider />
        <SectionHeading number="01" className="my-6">
          Palette
        </SectionHeading>
        <ul className="grid grid-cols-2 gap-4 tablet:grid-cols-4">
          {swatches.map(([label, color]) => (
            <li key={label} className="type-caption text-secondary">
              <div
                className={`mb-2 h-10 rounded border border-line ${color}`}
              />
              {label}
            </li>
          ))}
        </ul>
      </Section>
      <Section>
        <SectionDivider />
        <SectionHeading number="02" className="my-6">
          Components
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-4">
          <Button>
            <Icon icon={Info} size="button" />
            Primary
          </Button>
          <Button variant="secondary">Secondary</Button>
          <Button disabled>Disabled</Button>
          <TextLink href="#motion-preview">Motion samples</TextLink>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <IconButton label="Preview information" icon={Info} />
              </TooltipTrigger>
              <TooltipContent>Tooltip preview</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TechnologyLabel>TypeScript</TechnologyLabel>
        </div>
      </Section>
      <Section id="motion-preview">
        <SectionHeading number="03" className="mb-6">
          Motion
        </SectionHeading>
        {(['fade-up', 'elements'] as const).map((pattern) => {
          const { group, item } = staggeredEntrance(pattern, reduced)
          return (
            <motion.ul
              key={pattern}
              className="mb-6 grid gap-2"
              variants={group}
              initial={reduced ? false : 'hidden'}
              whileInView="visible"
              viewport={{ once: true }}
            >
              {[1, 2, 3].map((number) => (
                <motion.li key={number} variants={item}>
                  {pattern} {number}
                </motion.li>
              ))}
            </motion.ul>
          )
        })}
      </Section>
    </main>
  )
}
