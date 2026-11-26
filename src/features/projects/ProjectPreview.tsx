import { useState } from 'react'
import type { ComponentProps } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { staggeredEntrance } from '@/animations/variants'
import type { Project } from '@/data/projects'
import { ProjectLinks } from './ProjectLinks'

function CoverImage({
  project,
  desktop = false,
  ...props
}: { project: Project; desktop?: boolean } & Pick<
  ComponentProps<'img'>,
  'onLoad' | 'onError' | 'aria-hidden'
>) {
  return (
    <img
      {...props}
      src={project.image}
      alt={props['aria-hidden'] ? '' : (project.imageAlt ?? project.title)}
      width="1600"
      height="900"
      loading={props.onLoad ? 'eager' : 'lazy'}
      decoding="async"
      className={`h-full w-full object-contain transition-[filter] duration-(--duration-moderate) motion-reduce:transition-none ${desktop ? 'object-left [@media(hover:hover)_and_(pointer:fine)]:grayscale [@media(hover:hover)_and_(pointer:fine)]:group-hover:grayscale-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within:grayscale-0' : ''}`}
    />
  )
}

function CoverLayer({
  project,
  outgoing,
  revealing,
  onFinish,
}: {
  project: Project
  outgoing: boolean
  revealing: boolean
  onFinish: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div
      aria-hidden={outgoing || undefined}
      data-project-cover-layer={project.id}
      data-outgoing={outgoing || undefined}
      className={`absolute inset-0 ${revealing ? 'project-cover-incoming pointer-events-none' : outgoing ? 'pointer-events-none' : ''}`}
      data-ready={revealing ? loaded : undefined}
      onAnimationEnd={(event) => {
        if (
          event.target === event.currentTarget &&
          event.animationName === 'project-cover-reveal'
        )
          onFinish()
      }}
    >
      <CoverImage
        project={project}
        desktop
        aria-hidden={outgoing || undefined}
        onLoad={revealing ? () => setLoaded(true) : undefined}
        onError={revealing ? onFinish : undefined}
      />
    </div>
  )
}

export function DesktopProjectPreview({
  project,
  position,
  total,
  reduced,
}: {
  project: Project
  position: number
  total: number
  reduced: boolean
}) {
  const [settled, setSettled] = useState(project)
  const transitioning =
    !reduced && settled.id !== project.id && Boolean(settled.image)
  const counter = `${String(position).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
  const layers = transitioning ? [settled, project] : [project]

  return (
    <div className="project-preview-frame space-y-2">
      <figure
        className="group"
        tabIndex={project.image ? 0 : undefined}
        aria-label={
          project.image ? `Project cover for ${project.title}` : undefined
        }
      >
        {project.image && (
          <div className="project-preview-cover relative isolate aspect-video overflow-hidden">
            {layers.map((layer) => (
              <CoverLayer
                key={layer.id}
                project={layer}
                outgoing={layer.id !== project.id}
                revealing={transitioning && layer.id === project.id}
                onFinish={() => setSettled(project)}
              />
            ))}
          </div>
        )}
        <figcaption
          key={project.id}
          className="project-detail-enter type-mono mt-2 flex flex-wrap gap-x-4 text-muted"
        >
          <span>{counter}</span>
          {project.illustrative && <span>Illustrative preview</span>}
        </figcaption>
      </figure>
      <div key={project.id} className="project-detail-groups space-y-2">
        <h3 className="type-h3">{project.title}</h3>
        <p className="type-body max-w-[65ch] text-secondary">
          {project.description}
        </p>
        <ul
          aria-label="Project technologies"
          className="flex flex-wrap gap-x-4 gap-y-2"
        >
          {project.technologies.map((technology) => (
            <li key={technology} className="type-mono text-secondary">
              {technology}
            </li>
          ))}
        </ul>
        <ProjectLinks project={project} />
      </div>
    </div>
  )
}

export function ProjectPreview({ project }: { project: Project }) {
  const reduced = useReducedMotion() ?? false
  const { group, item } = staggeredEntrance('elements', reduced)

  return (
    <div className="space-y-5">
      {project.image && (
        <figure className="group">
          <div className="aspect-video w-full">
            <CoverImage project={project} />
          </div>
          {project.illustrative && (
            <figcaption className="type-mono mt-2 text-muted">
              Illustrative preview
            </figcaption>
          )}
        </figure>
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
