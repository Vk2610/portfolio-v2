import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowUpRight, Plus } from 'lucide-react'
import { Section } from '@/components/layout/Section'
import { SectionDivider } from '@/components/common/SectionDivider'
import { entranceTransition } from '@/animations/transitions'
import { staggeredEntrance } from '@/animations/variants'
import { featuredProjects } from '@/data/projects'
import { ProjectPreview } from '@/features/projects/ProjectPreview'
import './selected-projects.css'

export function SelectedProjects() {
  const [committed, setCommitted] = useState(featuredProjects[0]?.id)
  const [preview, setPreview] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(
    featuredProjects[0]?.id ?? null,
  )
  const reduced = useReducedMotion() ?? false
  const active =
    featuredProjects.find((project) => project.id === (preview ?? committed)) ??
    featuredProjects[0]
  const { group, item } = staggeredEntrance('elements', reduced)
  const heading = staggeredEntrance('fade-up', reduced)
  const transition = reduced
    ? { duration: 0 }
    : entranceTransition('--duration-moderate')
  if (!active) return null

  return (
    <Section
      id="work"
      aria-labelledby="work-heading"
      className="scroll-mt-(--navbar-height) desktop:pt-4"
    >
      <motion.div
        variants={heading.group}
        initial={reduced ? false : 'hidden'}
        whileInView="visible"
        viewport={{ once: true }}
      >
        <motion.p variants={heading.item} className="type-mono text-muted">
          05 / SELECTED WORK
        </motion.p>
        <motion.h2
          variants={heading.item}
          id="work-heading"
          className="type-h2 mt-7 desktop:mt-2"
        >
          Things I've built.
        </motion.h2>
        <motion.p
          variants={heading.item}
          className="mt-4 max-w-[65ch] text-secondary desktop:mt-2"
        >
          A selection of my work across software development, real-time
          collaboration and machine learning.
        </motion.p>
      </motion.div>
      <p className="type-mono my-8 text-muted desktop:mt-3 desktop:mb-2">
        FEATURED PROJECTS / {String(featuredProjects.length).padStart(2, '0')}
      </p>
      <SectionDivider />
      <div
        className="hidden gap-10 desktop:grid desktop:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)] desktop:py-3"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget))
            setPreview(null)
        }}
      >
        <motion.div
          role="group"
          aria-label="Featured project index"
          variants={group}
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true }}
          onMouseLeave={() => setPreview(null)}
        >
          {featuredProjects.map((project, index) => (
            <motion.button
              key={project.id}
              variants={item}
              type="button"
              aria-pressed={committed === project.id}
              aria-controls="project-preview"
              className={`group flex w-full gap-3 border-b py-6 text-left ${active.id === project.id ? 'border-line-hover text-foreground' : 'border-line-subtle text-secondary'}`}
              onPointerEnter={(event) => {
                if (
                  event.pointerType === 'mouse' &&
                  window.matchMedia('(hover: hover) and (pointer: fine)')
                    .matches
                )
                  setPreview(project.id)
              }}
              onFocus={() => setPreview(project.id)}
              onClick={() => {
                setCommitted(project.id)
                setPreview(null)
              }}
            >
              <span className="type-mono">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-medium">
                  {project.title}
                </span>
                <span className="type-mono mt-2 block text-muted">
                  {project.category}
                </span>
              </span>
              <ArrowUpRight
                aria-hidden
                size={20}
                strokeWidth={1.5}
                className="shrink-0 transition-transform duration-(--duration-normal) group-hover:-translate-y-0.5 group-hover:translate-x-0.5 motion-reduce:transition-none"
              />
            </motion.button>
          ))}
        </motion.div>
        <div
          id="project-preview"
          className="project-preview-stage min-w-0"
          aria-live="polite"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={active.id}
              className="project-preview-frame"
              initial={{ opacity: reduced ? 1 : 0, x: reduced ? 0 : 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reduced ? 0 : -8 }}
              transition={transition}
            >
              <ProjectPreview
                project={active}
                position={featuredProjects.indexOf(active) + 1}
                total={featuredProjects.length}
                desktop
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="desktop:hidden">
        {featuredProjects.map((project, index) => {
          const open = expanded === project.id
          return (
            <article key={project.id} className="border-b border-line-subtle">
              <h3>
                <button
                  id={`project-trigger-${project.id}`}
                  type="button"
                  aria-expanded={open}
                  aria-controls={`project-panel-${project.id}`}
                  onClick={() => setExpanded(open ? null : project.id)}
                  className="flex min-h-11 w-full items-center gap-3 py-6 text-left"
                >
                  <span className="type-mono text-secondary">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{project.title}</span>
                    <span className="type-mono mt-2 block text-muted">
                      {project.category}
                    </span>
                  </span>
                  <Plus
                    aria-hidden
                    size={18}
                    className={`shrink-0 transition-transform duration-(--duration-menu) motion-reduce:transition-none ${open ? 'rotate-45' : ''}`}
                  />
                </button>
              </h3>
              <motion.div
                id={`project-panel-${project.id}`}
                role="region"
                aria-labelledby={`project-trigger-${project.id}`}
                inert={!open}
                aria-hidden={!open}
                initial={false}
                animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
                transition={transition}
                className="overflow-hidden"
              >
                {open && (
                  <div className="pb-7">
                    <ProjectPreview
                      project={project}
                      position={index + 1}
                      total={featuredProjects.length}
                    />
                  </div>
                )}
              </motion.div>
            </article>
          )
        })}
      </div>
      <SectionDivider />
    </Section>
  )
}
