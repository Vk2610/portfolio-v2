import { technologies, type TechnologyId } from '@/data/technologies'
import type { NetworkConnection, TechnologyNode } from './network.types'

export const networkInteraction = {
  hoverScale: 1.14,
  magneticLimit: 7,
  transition: 250,
  ringOffset: 8,
  orbitDot: 6,
  orbitDuration: 2500,
  cursorDot: 6,
  unrelatedOpacity: 0.32,
  tooltipDelay: 200,
  tooltipReveal: 150,
  parallaxLimit: 9,
  dragThreshold: 6,
} as const

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
  react: [0.532, 0.638, 0.98],
  nodedotjs: [0.53, 0.33, 0.96],
  javascript: [0.34, 0.29, 0.76],
  typescript: [0.11, 0.91, 0.84],
  express: [0.776, 0.326, 0.76],
  mongodb: [0.745, 0.52, 0.68],
  mysql: [0.737, 0.712, 0.66],
  postgresql: [0.918, 0.865, 0.64],
  tailwindcss: [0.16, 0.49, 0.78],
  github: [0.508, 0.972, 0.78],
  vercel: [0.675, 0.903, 0.69],
  python: [1, 0.16, 0.72],
  html5: [0.209, 0.159, 0.43],
  css3: [0, 0.69, 0.52],
  bootstrap: [0.242, 0.665, 0.42],
  nextdotjs: [0.647, 0.186, 0.62],
  pandas: [1, 0.701, 0.47],
  firebase: [0.729, 0, 0.57],
  git: [0.32, 0.91, 0.43],
  visualstudiocode: [0.338, 0.725, 0.56],
  postman: [0.994, 0.468, 0.48],
  figma: [0.041, 0.251, 0.4],
} as const satisfies Record<
  Exclude<TechnologyId, 'sql'>,
  readonly [number, number, number]
>

export const technologyNodes: readonly TechnologyNode[] = technologies
  .filter((technology) => technology.id !== 'sql')
  .map((technology) => {
    const [x, y, depth] = placements[technology.id]
    return { ...technology, base: { x, y }, depth }
  })

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
