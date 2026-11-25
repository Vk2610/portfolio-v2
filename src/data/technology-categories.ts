import { technologies, type TechnologyId } from './technologies'

const groups = [
  {
    id: 'frontend',
    label: 'Frontend',
    ids: ['react', 'html5', 'css3', 'tailwindcss', 'bootstrap', 'nextdotjs'],
  },
  {
    id: 'backend',
    label: 'Backend',
    ids: ['nodedotjs', 'express', 'firebase'],
  },
  {
    id: 'database',
    label: 'Database',
    ids: ['mongodb', 'mysql', 'postgresql'],
  },
  {
    id: 'languages',
    label: 'Languages',
    ids: ['javascript', 'typescript', 'python', 'sql'],
  },
  {
    id: 'tools',
    label: 'Tools & Others',
    ids: [
      'git',
      'github',
      'visualstudiocode',
      'postman',
      'figma',
      'vercel',
      'pandas',
    ],
  },
] as const satisfies readonly {
  id: string
  label: string
  ids: readonly TechnologyId[]
}[]

export const technologyCategories = groups.map(({ id, label, ids }) => ({
  id,
  label,
  technologies: (ids as readonly TechnologyId[]).flatMap((technologyId) =>
    technologies.filter((technology) => technology.id === technologyId),
  ),
}))
