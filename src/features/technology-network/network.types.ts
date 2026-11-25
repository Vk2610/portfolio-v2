import type { Technology, TechnologyId } from '@/data/technologies'

export type Point = { x: number; y: number }

export type TechnologyNode = Technology & {
  base: Readonly<Point>
  depth: number
}

export type NetworkConnection = {
  from: TechnologyId
  to: TechnologyId
  packet: { phase: number; period: number }
}

export type ProjectedNode = {
  technology: TechnologyNode
  base: Point
  ambient: Point
  dragOffset: Point
  projected: Point
  radius: number
  opacity: number
}
