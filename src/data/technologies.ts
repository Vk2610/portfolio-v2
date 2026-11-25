type TechnologyTier = 'primary' | 'core' | 'supporting'
type TechnologyCategory =
  'frontend' | 'backend' | 'databases' | 'data' | 'tools'

function technology<Id extends string>(
  id: Id,
  label: string,
  tier: TechnologyTier,
  category: TechnologyCategory,
) {
  return {
    id,
    label,
    tier,
    category,
    iconPath: `icons/technologies/${id}.svg`,
  } as const
}

export const technologies = [
  technology('react', 'React', 'primary', 'frontend'),
  technology('nodedotjs', 'Node.js', 'primary', 'backend'),
  technology('javascript', 'JavaScript', 'core', 'frontend'),
  technology('typescript', 'TypeScript', 'core', 'frontend'),
  technology('express', 'Express.js', 'core', 'backend'),
  technology('mongodb', 'MongoDB', 'core', 'databases'),
  technology('mysql', 'MySQL', 'core', 'databases'),
  technology('postgresql', 'PostgreSQL', 'core', 'databases'),
  technology('tailwindcss', 'Tailwind CSS', 'core', 'frontend'),
  technology('github', 'GitHub', 'core', 'tools'),
  technology('vercel', 'Vercel', 'core', 'tools'),
  technology('python', 'Python', 'core', 'data'),
  technology('html5', 'HTML5', 'supporting', 'frontend'),
  technology('css3', 'CSS3', 'supporting', 'frontend'),
  technology('bootstrap', 'Bootstrap', 'supporting', 'frontend'),
  technology('nextdotjs', 'Next.js', 'supporting', 'frontend'),
  technology('pandas', 'Pandas', 'supporting', 'data'),
  technology('firebase', 'Firebase', 'supporting', 'backend'),
  technology('git', 'Git', 'supporting', 'tools'),
  technology('visualstudiocode', 'VS Code', 'supporting', 'tools'),
  technology('postman', 'Postman', 'supporting', 'tools'),
  technology('figma', 'Figma', 'supporting', 'tools'),
] as const

export type Technology = (typeof technologies)[number]
export type TechnologyId = Technology['id']
