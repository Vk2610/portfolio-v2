import rkky from '@/assets/rkky.png'
import miro from '@/assets/miro.png'
import cattle from '@/assets/cattle-breed.png'

export type Project = {
  id: string
  title: string
  category: string
  description: string
  shortDescription: string
  technologies: readonly string[]
  image?: string
  imageAlt?: string
  illustrative?: boolean
  repositoryUrl?: string
  liveUrl?: string
  featuredRank?: 1 | 2 | 3 | 4
  visible: boolean
}

export function selectProjects(catalog: readonly Project[]) {
  const ids = new Set<string>()
  const ranks = new Set<number>()
  for (const project of catalog) {
    if (ids.has(project.id)) throw new Error('Duplicate project ID')
    ids.add(project.id)
    if (project.featuredRank !== undefined) {
      if (
        project.featuredRank < 1 ||
        project.featuredRank > 4 ||
        ranks.has(project.featuredRank)
      )
        throw new Error('Invalid or duplicate featured rank')
      ranks.add(project.featuredRank)
    }
  }
  const visible = catalog.filter((project) => project.visible)
  return {
    featured: visible
      .filter((project) => project.featuredRank !== undefined)
      .sort((a, b) => a.featuredRank! - b.featuredRank!),
    archive: visible.filter((project) => project.featuredRank === undefined),
  }
}

export const projects: readonly Project[] = [
  {
    id: 'rkky',
    title: 'Rayat Kutumb Kalyan Yojana',
    category: 'Welfare Management Platform',
    description:
      'A digital welfare management platform supporting member registration, role-based authentication, claims, payments and document generation.',
    shortDescription: 'A digital welfare management platform.',
    technologies: ['React', 'Node.js', 'Express.js', 'MySQL', 'Cloudinary'],
    image: rkky,
    imageAlt: 'Illustrative preview of Rayat Kutumb Kalyan Yojana',
    illustrative: true,
    repositoryUrl: 'https://github.com/Vk2610/rayat-kutumb-kalyan-frontend',
    liveUrl:
      'https://rayat-kutumb-kalyan-frontend-git-main-vk2610s-projects.vercel.app/',
    featuredRank: 1,
    visible: true,
  },
  {
    id: 'miro',
    title: 'Miro Clone',
    category: 'Real-time Collaboration',
    description:
      'A collaborative digital whiteboard supporting drawing, shapes, sticky notes, real-time multiplayer interactions and integrated live chat.',
    shortDescription: 'A collaborative whiteboard with integrated live chat.',
    technologies: ['Next.js', 'Liveblocks', 'Convex', 'Clerk'],
    image: miro,
    imageAlt: 'Miro Clone collaborative whiteboard',
    repositoryUrl: 'https://github.com/Vk2610/Miro',
    liveUrl: 'https://miro-nine.vercel.app/',
    featuredRank: 2,
    visible: true,
  },
  {
    id: 'cattle',
    title: 'Cattle Breed Detector',
    category: 'Machine Learning & Computer Vision',
    description:
      'A computer vision application using a convolutional neural network to identify indigenous Indian cattle breeds.',
    shortDescription: 'Computer vision for indigenous Indian cattle breeds.',
    technologies: ['Python', 'PyTorch', 'Computer Vision', 'Machine Learning'],
    image: cattle,
    imageAlt: 'Illustrative preview of Cattle Breed Detector',
    illustrative: true,
    repositoryUrl: 'https://github.com/Vk2610/Cattle-Breed-Detector',
    featuredRank: 3,
    visible: true,
  },
]

export const { featured: featuredProjects } = selectProjects(projects)
