import { technologies, type TechnologyId } from '@/data/technologies'
import type { NetworkConnection, TechnologyNode } from './network.types'

export const networkVisual = {
  depthIntensity: 0.675,
  networkSpread: 0.925,
  horizontalExpansion: 1.275,
  verticalExpansion: 1.125,
  boundaryClearance: { desktop: 20, mobile: 10 },
  primarySizeFactor: 0.9,
  magneticClearance: 1.14,
  depthOpacity: { background: 0.82, foreground: 1 },
  connectionVisibility: 0.675,
} as const

// Curated normalized positions keep related technologies interwoven.
const placements = {
  react: [0.39, 0.42, 0.98],
  nodedotjs: [0.61, 0.56, 0.96],
  javascript: [0.49, 0.25, 0.76],
  typescript: [0.35, 0.63, 0.84],
  express: [0.76, 0.39, 0.76],
  mongodb: [0.86, 0.54, 0.68],
  mysql: [0.76, 0.73, 0.66],
  postgresql: [0.87, 0.75, 0.64],
  tailwindcss: [0.19, 0.42, 0.78],
  github: [0.53, 0.83, 0.78],
  vercel: [0.68, 0.85, 0.69],
  python: [0.9, 0.3, 0.72],
  html5: [0.23, 0.22, 0.43],
  css3: [0.1, 0.58, 0.52],
  bootstrap: [0.27, 0.78, 0.42],
  nextdotjs: [0.55, 0.13, 0.62],
  pandas: [0.98, 0.57, 0.47],
  firebase: [0.67, 0.23, 0.57],
  git: [0.36, 0.91, 0.43],
  visualstudiocode: [0.4, 0.75, 0.56],
  postman: [0.98, 0.4, 0.48],
  figma: [0.13, 0.27, 0.4],
} as const satisfies Record<TechnologyId, readonly [number, number, number]>

export const technologyNodes: readonly TechnologyNode[] = technologies.map(
  (technology) => {
    const [x, y, depth] = placements[technology.id]
    return { ...technology, base: { x, y }, depth }
  },
)

const connections = [
  ['react', 'javascript'],
  ['react', 'typescript'],
  ['react', 'tailwindcss'],
  ['react', 'nextdotjs'],
  ['react', 'firebase'],
  ['javascript', 'typescript'],
  ['javascript', 'html5'],
  ['html5', 'css3'],
  ['css3', 'tailwindcss'],
  ['bootstrap', 'react'],
  ['nextdotjs', 'vercel'],
  ['javascript', 'nodedotjs'],
  ['nodedotjs', 'express'],
  ['express', 'mongodb'],
  ['express', 'mysql'],
  ['express', 'postgresql'],
  ['express', 'postman'],
  ['nodedotjs', 'firebase'],
  ['python', 'pandas'],
  ['python', 'mysql'],
  ['python', 'postgresql'],
  ['python', 'mongodb'],
  ['github', 'git'],
  ['github', 'vercel'],
  ['github', 'visualstudiocode'],
  ['visualstudiocode', 'javascript'],
  ['visualstudiocode', 'typescript'],
  ['postman', 'nodedotjs'],
  ['figma', 'tailwindcss'],
  ['bootstrap', 'css3'],
  ['mongodb', 'postman'],
  ['vercel', 'nodedotjs'],
  ['pandas', 'postgresql'],
  ['react', 'figma'],
  ['tailwindcss', 'typescript'],
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
