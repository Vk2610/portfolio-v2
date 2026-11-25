export type ExperienceEntry = {
  company: string
  role: string
  employmentType: string
  startDate: string
  endDate: string
  location: string
  description: string
  technologies: readonly string[]
}

export const experience: readonly ExperienceEntry[] = [
  {
    company: 'Silicon Savants',
    role: 'Full Stack Developer Intern',
    employmentType: 'Internship',
    startDate: '23 February 2025',
    endDate: '29 May 2025',
    location: 'Satara, Maharashtra',
    description:
      'Contributed to full-stack web application development using React, Node.js and Express.js. Worked on responsive interfaces, RESTful APIs and database integrations while contributing to debugging, testing, deployment and collaborative development.',
    technologies: ['React', 'Node.js', 'Express.js', 'MySQL', 'MongoDB'],
  },
]
