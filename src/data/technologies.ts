type TechnologyTier = 'primary' | 'core' | 'supporting'
type TechnologyCategory =
  'frontend' | 'backend' | 'databases' | 'data' | 'tools'

function technology<Id extends string>(
  id: Id,
  label: string,
  tier: TechnologyTier,
  category: TechnologyCategory,
  description: string,
) {
  return {
    id,
    label,
    tier,
    category,
    description,
    iconPath: `icons/technologies/${id}.svg`,
  } as const
}

export const technologies = [
  technology(
    'react',
    'React',
    'primary',
    'frontend',
    'Library for building component-based user interfaces.',
  ),
  technology(
    'nodedotjs',
    'Node.js',
    'primary',
    'backend',
    'JavaScript runtime for servers and command-line tools.',
  ),
  technology(
    'javascript',
    'JavaScript',
    'core',
    'frontend',
    'Programming language for interactive web applications.',
  ),
  technology(
    'typescript',
    'TypeScript',
    'core',
    'frontend',
    'JavaScript with static type checking.',
  ),
  technology(
    'express',
    'Express.js',
    'core',
    'backend',
    'Framework for HTTP servers and APIs in Node.js.',
  ),
  technology(
    'mongodb',
    'MongoDB',
    'core',
    'databases',
    'Document database for flexible records.',
  ),
  technology(
    'mysql',
    'MySQL',
    'core',
    'databases',
    'Relational database queried with SQL.',
  ),
  technology(
    'postgresql',
    'PostgreSQL',
    'core',
    'databases',
    'Relational database with advanced SQL and extensibility.',
  ),
  technology(
    'tailwindcss',
    'Tailwind CSS',
    'core',
    'frontend',
    'Utility-first CSS framework for styling interfaces.',
  ),
  technology(
    'github',
    'GitHub',
    'core',
    'tools',
    'Platform for hosting and collaborating on Git repositories.',
  ),
  technology(
    'vercel',
    'Vercel',
    'core',
    'tools',
    'Platform for deploying web applications.',
  ),
  technology(
    'python',
    'Python',
    'core',
    'data',
    'Programming language used for automation and data analysis.',
  ),
  technology(
    'sql',
    'SQL',
    'supporting',
    'databases',
    'Structured Query Language for querying and managing relational databases.',
  ),
  technology(
    'html5',
    'HTML5',
    'supporting',
    'frontend',
    'Markup for structuring web pages.',
  ),
  technology(
    'css3',
    'CSS3',
    'supporting',
    'frontend',
    'Style sheets for web layout and presentation.',
  ),
  technology(
    'bootstrap',
    'Bootstrap',
    'supporting',
    'frontend',
    'Responsive UI framework with reusable styles and components.',
  ),
  technology(
    'nextdotjs',
    'Next.js',
    'supporting',
    'frontend',
    'React framework with routing and server rendering.',
  ),
  technology(
    'pandas',
    'Pandas',
    'supporting',
    'data',
    'Python library for working with tabular data.',
  ),
  technology(
    'firebase',
    'Firebase',
    'supporting',
    'backend',
    'Backend platform with authentication, data storage and hosting.',
  ),
  technology(
    'git',
    'Git',
    'supporting',
    'tools',
    'Distributed version control system.',
  ),
  technology(
    'visualstudiocode',
    'VS Code',
    'supporting',
    'tools',
    'Code editor with debugging and extension support.',
  ),
  technology(
    'postman',
    'Postman',
    'supporting',
    'tools',
    'Tool for sending and testing API requests.',
  ),
  technology(
    'figma',
    'Figma',
    'supporting',
    'tools',
    'Collaborative interface design and prototyping tool.',
  ),
] as const

export type Technology = (typeof technologies)[number]
export type TechnologyId = Technology['id']
