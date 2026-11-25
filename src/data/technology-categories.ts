import { technologies, type TechnologyId } from './technologies'

const groups = [
  {
    id: 'frontend',
    label: 'Frontend',
    ids: [
      'react',
      'javascript',
      'typescript',
      'html5',
      'css3',
      'tailwindcss',
      'bootstrap',
      'nextdotjs',
    ],
  },
  {
    id: 'backend-data',
    label: 'Backend & Data',
    ids: ['nodedotjs', 'express', 'python', 'pandas', 'firebase'],
  },
  {
    id: 'databases',
    label: 'Databases',
    ids: ['mongodb', 'mysql', 'postgresql'],
  },
  {
    id: 'tools-platforms',
    label: 'Tools & Platforms',
    ids: ['git', 'github', 'visualstudiocode', 'postman', 'figma', 'vercel'],
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
