import { technologies, type TechnologyId } from '@/data/technologies'
import type { NetworkConnection, TechnologyNode } from './network.types'

// Normalized x, y, and depth. Frontend is left of the runtime and data clusters.
const placements = {
  react: [0.32, 0.36, 0.92],
  nodedotjs: [0.66, 0.46, 0.85],
  javascript: [0.48, 0.2, 0.75],
  typescript: [0.46, 0.59, 0.8],
  express: [0.78, 0.3, 0.7],
  mongodb: [0.93, 0.48, 0.65],
  mysql: [0.76, 0.69, 0.6],
  postgresql: [0.96, 0.68, 0.58],
  tailwindcss: [0.14, 0.43, 0.7],
  github: [0.45, 0.81, 0.77],
  vercel: [0.64, 0.86, 0.68],
  python: [0.93, 0.77, 0.57],
  html5: [0.06, 0.25, 0.42],
  css3: [0.07, 0.61, 0.5],
  bootstrap: [0.18, 0.78, 0.33],
  nextdotjs: [0.24, 0.13, 0.58],
  pandas: [0.88, 0.95, 0.44],
  firebase: [0.64, 0.09, 0.55],
  git: [0.33, 0.95, 0.37],
  visualstudiocode: [0.29, 0.62, 0.52],
  postman: [0.94, 0.18, 0.44],
  figma: [0.04, 0.06, 0.36],
} as const satisfies Record<TechnologyId, readonly [number, number, number]>

export const technologyNodes: readonly TechnologyNode[] = technologies.map(
  (technology) => {
    const [x, y, depth] = placements[technology.id]
    return { ...technology, base: { x, y }, depth }
  },
)

const connections = [
  ['react', 'javascript'],
  ['javascript', 'nodedotjs'],
  ['react', 'typescript'],
  ['typescript', 'nodedotjs'],
  ['react', 'tailwindcss'],
  ['react', 'nextdotjs'],
  ['figma', 'react'],
  ['html5', 'react'],
  ['css3', 'tailwindcss'],
  ['css3', 'bootstrap'],
  ['javascript', 'firebase'],
  ['nodedotjs', 'express'],
  ['express', 'mongodb'],
  ['nodedotjs', 'mysql'],
  ['nodedotjs', 'postgresql'],
  ['express', 'postgresql'],
  ['postman', 'express'],
  ['python', 'mysql'],
  ['python', 'postgresql'],
  ['mysql', 'postgresql'],
  ['python', 'pandas'],
  ['typescript', 'visualstudiocode'],
  ['visualstudiocode', 'github'],
  ['git', 'github'],
  ['github', 'vercel'],
  ['nodedotjs', 'vercel'],
] as const satisfies readonly (readonly [TechnologyId, TechnologyId])[]

export const networkConnections: readonly NetworkConnection[] = connections.map(
  ([from, to], index) => ({
    from,
    to,
    // Spread starts across the edge and vary loop times between 5 and 6.5 seconds.
    packet: {
      phase: (index * 0.61803398875) % 1,
      period: 5 + ((index * 7) % 16) / 10,
    },
  }),
)
