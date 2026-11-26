import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  Curve,
  DataTexture,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Shape,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  TubeGeometry,
  Vector3,
  Vector4,
} from 'three'
import { surface } from './geometry.js'

function expressionEye(parent, centerX, depth) {
  const vertices = []
  const eyeY = -0.15
  const geometry = surface(
    24,
    96,
    (t, angle) => {
      const r = Math.max(0.0001, 1 - t)
      const x = 0.36 * Math.cos(angle) * r
      const y = 0.4 * Math.sin(angle) * r
      vertices.push(x, y)
      return [centerX + x, eyeY + y, depth(centerX + x, eyeY + y) + 0.008]
    },
    { capEnd: true },
  )
  geometry.setAttribute(
    'localEye',
    new BufferAttribute(new Float32Array(vertices), 2),
  )
  const material = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      mixWeights: { value: new Vector4(1, 0, 0, 0) },
      blink: { value: 1 },
      side: { value: Math.sign(centerX) },
      cyan: { value: new Color('#77f4ff') },
      glow: { value: new Color('#2ddaf5') },
      angryColor: { value: new Color('#ff3344') },
      angryGlow: { value: new Color('#cc1124') },
    },
    vertexShader: `
      attribute vec2 localEye;
      varying vec2 eye;
      void main() {
        eye = localEye;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 eye;
      uniform vec4 mixWeights;
      uniform float blink;
      uniform float side;
      uniform vec3 cyan;
      uniform vec3 glow;
      uniform vec3 angryColor;
      uniform vec3 angryGlow;

      void main() {
        vec2 p = eye;
        vec2 neutral = abs(p / vec2(0.135, 0.245 * max(blink, 0.04)));
        float pill = (pow(neutral.x, 2.0/0.74) + pow(neutral.y, 2.0/0.74) - 1.0) * 0.048;
        vec2 a = p - vec2(0.0, -0.065);
        float arch = (a.y > 0.0 ? abs(length(a) - 0.143) :
          length(vec2(abs(a.x) - 0.143, a.y))) - 0.047;
        vec2 q = p - vec2(0.0, -0.047);
        float slant = max((length(q / vec2(0.211, 0.152)) - 1.0) * 0.13,
          (q.y - (q.x * side * 0.60 + 0.034)) * 0.86);
        float normalWeight = max(0.0001, 1.0 - mixWeights.z);
        float shape = dot(mixWeights.xyw, vec3(pill, arch, slant)) / normalWeight;
        float concentric = min(abs(length(p) - 0.165), abs(length(p) - 0.078)) - 0.024;
        float edge = fwidth(shape) + 0.001;
        float core = (1.0 - smoothstep(-edge, edge, shape)) * normalWeight;
        float ringEdge = fwidth(concentric) + 0.001;
        core += (1.0 - smoothstep(-ringEdge, ringEdge, concentric)) * mixWeights.z;
        float halo = exp(-max(shape, 0.0) * 58.0) * normalWeight
          + exp(-max(concentric, 0.0) * 54.0) * mixWeights.z;
        float fade = 1.0 - smoothstep(0.79, 1.0, length(p / vec2(0.36, 0.40)));
        float angryMix = clamp(mixWeights.w, 0.0, 1.0);
        vec3 baseColor = mix(cyan, angryColor, angryMix);
        vec3 baseGlow = mix(glow, angryGlow, angryMix);
        gl_FragColor = vec4(mix(baseGlow, baseColor, core),
          clamp(core + 0.27 * halo * (1.0 - core), 0.0, 1.0) * fade);
        if (gl_FragColor.a < 0.002) discard;
        #include <colorspace_fragment>
      }
    `,
  })
  const mesh = new Mesh(geometry, material)
  mesh.name = 'Visor expression'
  mesh.visible = false
  mesh.renderOrder = 3
  parent.add(mesh)
  return mesh
}

class OrbitPath extends Curve {
  constructor(radius, height, tilt) {
    super()
    this.radius = radius
    this.height = height
    this.tilt = tilt
  }

  getPoint(t, target = new Vector3()) {
    const angle = t * Math.PI * 2
    const x = this.radius * Math.cos(angle)
    return target.set(
      x,
      this.height + x * this.tilt + 0.22 * Math.sin(angle),
      this.radius * 0.83 * Math.sin(angle),
    )
  }
}

function makeOrbits(head) {
  const group = new Group()
  group.name = 'Dizzy rings and stars'
  group.visible = false
  head.add(group)
  const white = new MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const softWhite = new MeshBasicMaterial({
    color: '#eaf9ff',
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const gold = new MeshBasicMaterial({
    color: '#ffe39a',
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  })
  const paths = [
    new OrbitPath(1.32, 1.56, 0.125),
    new OrbitPath(1.16, 1.5, 0.085),
  ]
  for (const path of paths) {
    group.add(new Mesh(new TubeGeometry(path, 128, 0.009, 8, true), white))
    group.add(new Mesh(new TubeGeometry(path, 128, 0.021, 8, true), softWhite))
  }
  const profile = new Shape()
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + (i * Math.PI) / 5
    const radius = i % 2 ? 0.059 : 0.12
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius
    if (i === 0) profile.moveTo(x, y)
    else profile.lineTo(x, y)
  }
  profile.closePath()
  const geometry = new ExtrudeGeometry(profile, {
    depth: 0.025,
    bevelEnabled: true,
    bevelSize: 0.007,
    bevelThickness: 0.008,
    bevelSegments: 3,
  })
  geometry.center()
  const size = 48
  const pixels = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = Math.hypot((2 * x + 1) / size - 1, (2 * y + 1) / size - 1)
      const alpha = Math.max(0, 1 - r) ** 2
      pixels.set([255, 255, 255, Math.round(255 * alpha)], (y * size + x) * 4)
    }
  }
  const glowMap = new DataTexture(pixels, size, size)
  glowMap.needsUpdate = true
  const glowMaterial = new SpriteMaterial({
    color: '#ffc969',
    map: glowMap,
    blending: AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  const stars = Array.from({ length: 3 }, () => {
    const star = new Mesh(geometry, gold)
    const glow = new Sprite(glowMaterial)
    glow.scale.setScalar(0.55)
    glow.renderOrder = 5
    group.add(star, glow)
    return { star, glow }
  })

  return (weight, time, reduced) => {
    group.visible = weight > 0
    if (!group.visible) return
    white.opacity = weight * 0.91
    softWhite.opacity = weight * 0.21
    gold.opacity = weight
    glowMaterial.opacity = weight * 0.65
    const progress = reduced ? 0 : (time / 1950) % 1
    stars.forEach(({ star, glow }, index) => {
      const phase = (progress + index / 3 + 0.09) % 1
      paths[index % 2].getPoint(phase, star.position)
      glow.position.copy(star.position)
      star.rotation.set(
        0.1,
        Math.sin(phase * Math.PI * 2) * 0.48,
        -0.22 + index * 0.16,
      )
    })
  }
}

export function createFace(casing, approvedEyes, depth) {
  const patches = [-0.468, 0.468].map((x) => expressionEye(casing, x, depth))
  const orbits = makeOrbits(casing)
  return {
    update({ mix, blink }, time, reduced) {
      const useApproved = mix[0] === 1 && blink === 1
      for (const mesh of approvedEyes) mesh.visible = useApproved
      for (const patch of patches) {
        patch.visible = !useApproved
        if (!useApproved) {
          patch.material.uniforms.mixWeights.value.fromArray(mix)
          patch.material.uniforms.blink.value = blink
        }
      }
      orbits(mix[2], time, reduced)
    },
  }
}
