import { BufferAttribute, BufferGeometry } from 'three'

const channelDefaults = [0, 0, 0, 0, 1, 0]

function monotoneSlope(before, after) {
  return before * after <= 0 ? 0 : (2 * before * after) / (before + after)
}

function spline(a, b, c, d, t, isAxis) {
  const m0 = isAxis ? monotoneSlope(b - a, c - b) : (c - a) * 0.5
  const m1 = isAxis ? monotoneSlope(c - b, d - c) : (d - b) * 0.5
  const u = 1 - t
  return (
    b * (1 + 2 * t) * u * u +
    m0 * t * u * u +
    c * t * t * (3 - 2 * t) -
    m1 * t * t * u
  )
}

export function sampleProfile(profile, row) {
  const i = Math.min(Math.floor(row), profile.length - 2)
  const t = row - i
  return channelDefaults.map((fallback, j) =>
    spline(
      profile[Math.max(0, i - 1)][j] ?? fallback,
      profile[i][j] ?? fallback,
      profile[i + 1][j] ?? fallback,
      profile[Math.min(profile.length - 1, i + 2)][j] ?? fallback,
      t,
      j === 0,
    ),
  )
}

const signedPower = (x, exponent) => Math.sign(x) * Math.abs(x) ** exponent

// Each profile runs along Z. The changing section describes width, height,
// centre, contour fullness, and how far the sides wrap away from the front.
export function contour(profile, row, angle) {
  const [z, rx, ry, center = 0, exponent = 1, wrap = 0] = sampleProfile(
    profile,
    row,
  )
  const cos = signedPower(Math.cos(angle), exponent)
  const sin = signedPower(Math.sin(angle), exponent)
  return [
    Math.max(0.0001, rx) * cos,
    center + Math.max(0.0001, ry) * sin,
    z - wrap * cos * cos,
  ]
}

export function surface(rows, segments, getPoint, { capStart, capEnd } = {}) {
  const positions = []
  const indices = []
  for (let i = 0; i <= rows; i++) {
    for (let j = 0; j < segments; j++) {
      positions.push(...getPoint(i / rows, (j / segments) * Math.PI * 2))
      if (i < rows) {
        const a = i * segments + j
        const b = i * segments + ((j + 1) % segments)
        indices.push(a, b, a + segments, b, b + segments, a + segments)
      }
    }
  }
  if (capStart || capEnd) {
    for (let j = 1; j < segments - 1; j++) {
      const end = rows * segments
      if (capStart) indices.push(0, j + 1, j)
      if (capEnd) indices.push(end, end + j, end + j + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new BufferAttribute(new Float32Array(positions), 3),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function loft(profile, { vertical = false, radial = 72 } = {}) {
  return surface(
    (profile.length - 1) * 7,
    radial,
    (t, angle) => {
      const [x, y, z] = contour(profile, t * (profile.length - 1), angle)
      return vertical ? [x, z, -y] : [x, y, z]
    },
    { capStart: true, capEnd: true },
  )
}
