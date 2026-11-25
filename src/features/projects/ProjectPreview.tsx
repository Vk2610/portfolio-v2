import { motion, useReducedMotion } from 'motion/react'
import { staggeredEntrance } from '@/animations/variants'
import type { Project } from '@/data/projects'
import { ProjectLinks } from './ProjectLinks'

export function ProjectPreview({
  project,
  position,
  total,
  desktop = false,
}: {
  project: Project
  position: number
  total: number
  desktop?: boolean
}) {
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('elements', reduced)
  const counter = `${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
  return (
    <div className={desktop ? 'space-y-2' : 'space-y-5'}>
      {project.image && (
        <figure
          className="group"
          tabIndex={desktop ? 0 : undefined}
          aria-label={
            desktop ? `Project cover for ${project.title}` : undefined
          }
        >
          <div
            className={
              desktop
                ? 'project-preview-cover aspect-video'
                : 'aspect-video w-full'
            }
          >
            <img
              src={project.image}
              alt={project.imageAlt ?? project.title}
              width="1600"
              height="900"
              loading="lazy"
              decoding="async"
              className={`h-full w-full object-contain transition-[filter] duration-(--duration-moderate) motion-reduce:transition-none ${desktop ? 'object-left [@media(hover:hover)_and_(pointer:fine)]:grayscale [@media(hover:hover)_and_(pointer:fine)]:group-hover:grayscale-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:grayscale-0' : ''}`}
            />
          </div>
          {desktop ? (
            <figcaption className="type-mono mt-2 flex flex-wrap gap-x-4 text-muted">
              <span>{counter}</span>
              {project.illustrative && <span>Illustrative preview</span>}
            </figcaption>
          ) : (
            project.illustrative && (
              <figcaption className="type-mono mt-2 text-muted">
                Illustrative preview
              </figcaption>
            )
          )}
        </figure>
      )}
      {desktop && (
        <>
          {!project.image && <p className="type-mono text-muted">{counter}</p>}
          <h3 className="type-h3">{project.title}</h3>
        </>
      )}
      <p className="type-body max-w-[65ch] text-secondary">
        {project.description}
      </p>
      <motion.ul
        variants={group}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        aria-label="Project technologies"
        className="flex flex-wrap gap-x-4 gap-y-2"
      >
        {project.technologies.map((technology) => (
          <motion.li
            variants={item}
            key={technology}
            className="type-mono text-secondary"
          >
            {technology}
          </motion.li>
        ))}
      </motion.ul>
      <ProjectLinks project={project} />
    </div>
  )
}
