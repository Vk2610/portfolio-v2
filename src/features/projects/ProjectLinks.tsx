import { ArrowUpRight, Globe } from 'lucide-react'
import { TextLink } from '@/components/ui/TextLink'
import type { Project } from '@/data/projects'

export function ProjectLinks({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap gap-5">
      {project.repositoryUrl && (
        <TextLink
          href={project.repositoryUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Source code for ${project.title}`}
        >
          <span className="inline-flex items-center gap-2">
            <img
              src={`${import.meta.env.BASE_URL}icons/technologies/github.svg`}
              width="18"
              height="18"
              alt=""
            />
            Source code
          </span>
        </TextLink>
      )}
      {project.liveUrl && (
        <TextLink
          href={project.liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Live demo of ${project.title}`}
        >
          <span className="inline-flex items-center gap-2">
            <Globe
              size={18}
              strokeWidth={1.5}
              className="text-current"
              aria-hidden
            />
            Live demo
            <ArrowUpRight
              size={18}
              strokeWidth={1.5}
              className="text-current"
              aria-hidden
            />
          </span>
        </TextLink>
      )}
    </div>
  )
}
