import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  Group,
  LatheGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  ShaderMaterial,
  Vector2,
} from 'three'
import { contour, loft, sampleProfile, surface } from './geometry.js'

export const defaultScales = { head: 1, body: 0.6, overall: 1 }

// Coordinates follow the orthographic drawings. The largest helmet section
// sits behind the visor, and the glass wraps back as it reaches the temples.
const helmetProfile = [
  [-1.02, 0.001, 0.001, 0.03, 1, 0],
  [-1.0, 0.28, 0.31, 0.04, 0.96, 0],
  [-0.89, 0.62, 0.63, 0.045, 0.89, 0],
  [-0.69, 0.88, 0.83, 0.045, 0.83, 0],
  [-0.39, 1.06, 0.955, 0.035, 0.825, 0],
  [-0.04, 1.145, 1.005, 0.018, 0.815, 0],
  [0.3, 1.151, 0.981, 0.01, 0.79, 0],
  [0.57, 1.114, 0.916, -0.026, 0.735, 0.018],
  [0.81, 1.065, 0.782, -0.115, 0.69, 0.075],
  [0.936, 1.018, 0.652, -0.145, 0.665, 0.105],
  [0.965, 0.985, 0.628, -0.144, 0.665, 0.107],
  [0.961, 0.968, 0.615, -0.144, 0.665, 0.106],
]
const visorProfile = [
  helmetProfile.at(-1),
  [0.988, 0.959, 0.608, -0.144, 0.67, 0.103],
  [1.058, 0.903, 0.568, -0.144, 0.74, 0.101],
  [1.125, 0.757, 0.468, -0.144, 0.8, 0.067],
  [1.158, 0.547, 0.332, -0.144, 0.85, 0.027],
  [1.181, 0.296, 0.18, -0.144, 0.93, 0.008],
  [1.19, 0.001, 0.001, -0.144, 1, 0],
]

function material(color, roughness, metalness, clearcoat = 0, extra = {}) {
  return new MeshPhysicalMaterial({
    color,
    roughness,
    metalness,
    clearcoat,
    clearcoatRoughness: roughness * 0.75,
    ...extra,
  })
}

function mesh(parent, name, geometry, finish) {
  const part = new Mesh(geometry, finish)
  part.name = name
  parent.add(part)
  return part
}

function pivot(parent, name, x = 0, y = 0, z = 0) {
  const group = new Group()
  group.name = name
  group.position.set(x, y, z)
  parent.add(group)
  return group
}

function crownTrack(row, side) {
  return Math.PI / 2 + side * (0.31 + (row - 4.5) * 0.038)
}

function helmetPoint(row, angle) {
  const point = contour(helmetProfile, row, angle)
  if (row > 3.5 && row < 10.95) {
    const distance = Math.abs(angle - crownTrack(row, 1))
    const otherDistance = Math.abs(angle - crownTrack(row, -1))
    const fade =
      MathUtils.smoothstep(row, 3.5, 5.4) *
      (1 - MathUtils.smoothstep(row, 10.1, 10.95))
    const groove =
      0.009 *
      fade *
      Math.exp(-((Math.min(distance, otherDistance) / 0.026) ** 2))
    point[0] -= Math.cos(angle) * groove
    point[1] -= Math.sin(angle) * groove
  }
  return point
}

function crownSeam(parent, side, finish) {
  // The dark insert follows the recessed part of the crown, becoming a
  // narrower hairline as it rolls out of sight over the helmet.
  const geometry = surface(68, 8, (t, angle) => {
    const row = 4.18 + t * 6.01
    const track = crownTrack(row, side)
    const width =
      Math.sin(Math.PI * t) ** 0.35 *
      (0.0018 +
        0.007 *
          MathUtils.smoothstep(t, 0.18, 0.34) *
          (1 - MathUtils.smoothstep(t, 0.49, 0.68)))
    const point = contour(helmetProfile, row, track + Math.cos(angle) * width)
    point[0] += Math.cos(track) * (0.002 + Math.sin(angle) * 0.0015)
    point[1] += Math.sin(track) * (0.002 + Math.sin(angle) * 0.0015)
    return point
  })
  mesh(parent, 'Recessed crown seam', geometry, finish)
}

function turned(parent, name, profile, finish) {
  // Radii and axial heights describe a continuous turned part.
  return mesh(
    parent,
    name,
    new LatheGeometry(
      profile.map(([r, y]) => new Vector2(r, y)),
      88,
    ),
    finish,
  )
}

function glassDepth(x, y) {
  // Intersect a line parallel to Z with the same superellipse used by the
  // visor mesh, so the eye light conforms to the glass from every angle.
  let back = 0
  let front = visorProfile.length - 1
  for (let iteration = 0; iteration < 20; iteration++) {
    const row = (back + front) / 2
    const [, rx, ry, center, exponent] = sampleProfile(visorProfile, row)
    const radius =
      Math.abs(x / rx) ** (2 / exponent) +
      Math.abs((y - center) / ry) ** (2 / exponent)
    if (radius > 1) front = row
    else back = row
  }
  const [z, rx, , , , wrap] = sampleProfile(visorProfile, back)
  return z - wrap * (x / rx) ** 2
}

function makeEye(parent, x, light) {
  const eyeY = -0.15
  const ellipse = (radius, angle, glow) => {
    const exponent = glow ? 0.91 : 0.74
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const px =
      x +
      Math.sign(cos) *
        Math.abs(cos) ** exponent *
        (glow ? 0.34 : 0.135) *
        radius
    const py =
      eyeY +
      Math.sign(sin) *
        Math.abs(sin) ** exponent *
        (glow ? 0.43 : 0.245) *
        radius
    return [px, py, glassDepth(px, py) + (glow ? 0.008 : 0.014)]
  }
  const core = surface(10, 56, (t, a) =>
    ellipse(Math.max(0.0001, 1 - t), a, false),
  )
  mesh(parent, 'Cyan eye', core, light).renderOrder = 2
  const halo = surface(14, 64, (t, a) =>
    ellipse(Math.max(0.0001, 1 - t), a, true),
  )
  const weights = new Float32Array(halo.getAttribute('position').count)
  weights.forEach((_, i) => {
    weights[i] = 1 - Math.floor(i / 64) / 14
  })
  // One radial coordinate per vertex for smooth falloff on the curved glass.
  halo.setAttribute('falloff', new BufferAttribute(weights, 1))
  const haloMaterial = new ShaderMaterial({
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    uniforms: { tint: { value: new Color('#2ddaf5') } },
    vertexShader: `
      attribute float falloff;
      varying float radius;
      void main() {
        radius = falloff;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 tint;
      varying float radius;
      void main() {
        float fade = (1.0 - smoothstep(0.16, 1.0, radius)) * exp(-4.2 * radius * radius);
        gl_FragColor = vec4(tint, 0.64 * fade);
        #include <colorspace_fragment>
      }
    `,
  })
  mesh(parent, 'Eye light falloff', halo, haloMaterial).renderOrder = 1
}

function makeHead(head, materials) {
  const {
    shell,
    secondaryShell,
    bezel,
    glass,
    dark,
    metal,
    cyan,
    antennaLight,
    eye,
  } = materials
  const casing = pivot(head, 'Helmet shell', 0, 0.976)
  mesh(
    casing,
    'Pearlescent helmet',
    surface(
      200,
      220,
      (t, angle) => helmetPoint(t * (helmetProfile.length - 1), angle),
      { capStart: true },
    ),
    shell,
  )
  crownSeam(casing, -1, bezel)
  crownSeam(casing, 1, bezel)
  // The helmet loft's open front is occupied by the separately finished glass.
  mesh(
    casing,
    'Wraparound smoked visor',
    surface(
      70,
      144,
      (t, angle) => contour(visorProfile, t * (visorProfile.length - 1), angle),
      { capEnd: true },
    ),
    glass,
  )
  for (const side of [-1, 1]) {
    makeEye(casing, side * 0.468, eye)
    const ear = pivot(
      casing,
      side < 0 ? 'Left ear' : 'Right ear',
      side * 1.065,
      -0.09,
      -0.025,
    )
    ear.rotation.z = (-side * Math.PI) / 2
    turned(
      ear,
      'Dark ear gasket',
      [
        [0, -0.13],
        [0.35, -0.13],
        [0.423, -0.075],
        [0.438, -0.016],
        [0.434, 0.058],
        [0.402, 0.128],
        [0, 0.128],
      ],
      dark,
    )
    turned(
      ear,
      'Ear shell',
      [
        [0.39, 0.044],
        [0.424, 0.061],
        [0.434, 0.095],
        [0.425, 0.143],
        [0.402, 0.182],
        [0.365, 0.221],
        [0.325, 0.25],
        [0.303, 0.257],
        [0.293, 0.243],
        [0.271, 0.217],
        [0.296, 0.192],
      ],
      secondaryShell,
    )
    turned(
      ear,
      'Cyan inset ring',
      [
        [0.293, 0.211],
        [0.298, 0.232],
        [0.291, 0.252],
        [0.272, 0.265],
        [0.248, 0.254],
        [0.233, 0.231],
        [0.235, 0.203],
      ],
      cyan,
    )
    turned(
      ear,
      'Concave ear centre',
      [
        [0.237, 0.222],
        [0.225, 0.218],
        [0.198, 0.199],
        [0.154, 0.187],
        [0.09, 0.18],
        [0, 0.177],
      ],
      bezel,
    )

    const antenna = pivot(
      casing,
      side < 0 ? 'Left antenna' : 'Right antenna',
      side * 1.145,
      0.301,
      -0.115,
    )
    antenna.rotation.z = -side * 0.063
    antenna.rotation.x = -0.156
    turned(
      antenna,
      'Antenna socket',
      [
        [0, 0],
        [0.065, 0],
        [0.06, 0.108],
        [0.045, 0.174],
        [0.031, 0.181],
        [0, 0.181],
      ],
      dark,
    )
    turned(
      antenna,
      'Antenna stem',
      [
        [0, 0.13],
        [0.027, 0.13],
        [0.023, 0.802],
        [0.022, 0.843],
        [0, 0.843],
      ],
      metal,
    )
    turned(
      antenna,
      'Antenna light',
      Array.from({ length: 29 }, (_, i) => {
        const angle = Math.PI * (1 - i / 28)
        return [0.096 * Math.sin(angle), 0.887 + 0.091 * Math.cos(angle)]
      }),
      antennaLight,
    )
  }
}

function sculpt(parent, name, profile, finish) {
  return mesh(parent, name, loft(profile, { vertical: true }), finish)
}

function makeBody(body, { shell, dark }) {
  sculpt(
    body,
    'Dark neck',
    [
      [2.055, 0.001, 0.001],
      [2.09, 0.36, 0.31],
      [2.32, 0.39, 0.34],
      [2.55, 0.365, 0.305],
      [2.69, 0.29, 0.24],
      [2.76, 0.001, 0.001],
    ],
    dark,
  )
  const torso = pivot(body, 'Torso', 0, 0.78)
  sculpt(
    torso,
    'Lower torso joint',
    [
      [0, 0.09, 0.12],
      [0.06, 0.46, 0.32],
      [0.18, 0.66, 0.47],
      [0.37, 0.69, 0.5],
      [0.57, 0.58, 0.43],
      [0.65, 0.001, 0.001],
    ],
    dark,
  )
  sculpt(
    torso,
    'Rounded chest shell',
    [
      [0.18, 0.32, 0.29, -0.085, 0.95],
      [0.27, 0.55, 0.46, -0.095, 0.84],
      [0.43, 0.69, 0.55, -0.09, 0.79],
      [0.67, 0.716, 0.574, -0.073, 0.8],
      [0.93, 0.658, 0.53, -0.045, 0.83],
      [1.22, 0.575, 0.45, -0.037, 0.88],
      [1.45, 0.476, 0.376, -0.038, 0.92],
      [1.6, 0.358, 0.293, -0.028, 0.98],
      [1.63, 0.28, 0.23, -0.02],
    ],
    shell,
  )

  for (const side of [-1, 1]) {
    const name = side < 0 ? 'Left' : 'Right'
    const shoulder = pivot(
      torso,
      name + ' shoulder',
      side * 0.53,
      1.275,
      -0.032,
    )
    shoulder.rotation.z = side * 0.355
    shoulder.rotation.x = -0.075
    sculpt(
      shoulder,
      'Upper joint',
      [
        [-0.55, 0.001, 0.001],
        [-0.47, 0.27, 0.25],
        [-0.19, 0.324, 0.294],
        [0.017, 0.27, 0.247],
        [0.12, 0.14, 0.135],
        [0.14, 0.001, 0.001],
      ],
      dark,
    )
    const arm = pivot(shoulder, name + ' arm', 0, -0.23)
    sculpt(
      arm,
      'Pearlescent arm guard',
      [
        [-0.77, 0.21, 0.2, -0.026],
        [-0.72, 0.287, 0.265, -0.035, 0.84],
        [-0.6, 0.315, 0.281, -0.033, 0.87],
        [-0.37, 0.31, 0.267, -0.018, 0.91],
        [-0.16, 0.314, 0.279, -0.005],
        [-0.045, 0.267, 0.224, 0.003],
        [0, 0.092, 0.093],
      ],
      shell,
    )
    const hand = pivot(arm, name + ' wrist', 0, -0.71, 0.022)
    sculpt(
      hand,
      'Mitten hand',
      [
        [-0.43, 0.001, 0.001, -0.043],
        [-0.39, 0.145, 0.148, -0.031, 0.88],
        [-0.29, 0.224, 0.208, -0.02, 0.84],
        [-0.14, 0.25, 0.209, 0, 0.9],
        [0.008, 0.21, 0.183],
        [0.09, 0.001, 0.001],
      ],
      dark,
    )
    const hip = pivot(body, name + ' hip', side * 0.425, 0.93, -0.035)
    hip.rotation.z = side * 0.052
    sculpt(
      hip,
      'Hip joint',
      [
        [-0.54, 0.001, 0.001],
        [-0.47, 0.24, 0.23],
        [-0.34, 0.301, 0.274],
        [-0.12, 0.317, 0.302],
        [0.028, 0.24, 0.222],
        [0.13, 0.001, 0.001],
      ],
      dark,
    )
    const ankle = pivot(hip, name + ' ankle', 0, -0.545)
    sculpt(
      ankle,
      'Boot shell',
      [
        [-0.353, 0.255, 0.352, -0.078, 0.83],
        [-0.32, 0.325, 0.415, -0.085, 0.81],
        [-0.23, 0.331, 0.413, -0.092, 0.83],
        [-0.135, 0.312, 0.362, -0.06, 0.87],
        [-0.02, 0.29, 0.292, -0.025, 0.91],
        [0.25, 0.29, 0.265, 0.018, 0.96],
        [0.328, 0.245, 0.225, 0.02],
      ],
      shell,
    )
    sculpt(
      ankle,
      'Thin outsole',
      [
        [-0.385, 0.235, 0.325, -0.077, 0.85],
        [-0.368, 0.289, 0.376, -0.08, 0.82],
        [-0.346, 0.308, 0.392, -0.087, 0.82],
        [-0.326, 0.299, 0.383, -0.085, 0.84],
      ],
      dark,
    )
  }
}

export function createRobot() {
  const root = new Group()
  root.name = 'H1 Classic'
  const body = pivot(root, 'Body scale')
  const head = pivot(root, 'Neck pivot')
  const materials = {
    shell: material('#f5f5f7', 0.36, 0.07, 0.34, { envMapIntensity: 0.43 }),
    secondaryShell: material('#d1d5db', 0.32, 0.11, 0.32),
    glass: material('#080b10', 0.23, 0.16, 0.58, { envMapIntensity: 0.59 }),
    bezel: material('#1c2230', 0.32, 0.3, 0.25, { envMapIntensity: 0.32 }),
    dark: material('#20242c', 0.45, 0.13, 0.17, { envMapIntensity: 0.3 }),
    metal: material('#737587', 0.28, 0.6, 0.32, { envMapIntensity: 0.6 }),
    cyan: material('#1396ae', 0.31, 0.08, 0.24, {
      emissive: '#00e5ff',
      emissiveIntensity: 1.12,
      envMapIntensity: 0.22,
    }),
    antennaLight: material('#49ceea', 0.3, 0.04, 0.24, {
      emissive: '#39b9d2',
      emissiveIntensity: 0.9,
    }),
    eye: new MeshBasicMaterial({ color: '#77f4ff', toneMapped: false }),
  }
  makeHead(head, materials)
  makeBody(body, materials)

  function setScales({ head: headScale, body: bodyScale, overall }) {
    body.scale.setScalar(bodyScale)
    head.scale.setScalar(headScale)
    head.position.y = bodyScale * 2.63 - 0.018 * headScale
    root.scale.setScalar(overall)
    root.updateMatrixWorld(true)
  }

  setScales(defaultScales)
  return { root, setScales }
}
