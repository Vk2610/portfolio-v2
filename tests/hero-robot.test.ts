import { describe, expect, it, vi } from 'vitest'
import { Euler, Quaternion } from 'three'
import { createRobot } from '@/features/robot-preview/robot.js'
import { createEmotionController } from '@/features/robot-preview/emotions.js'
import { physicsDefaults } from '@/features/robot-preview/fall-physics.js'
import { createMovement } from '@/features/robot-preview/movement.js'
import { computeHeroRobotPlacement } from '@/features/hero-robot/hero-robot-placement'
import {
  createMagneticRobotCursor,
  interpolateParticleColor,
} from '@/features/hero-robot/magnetic-cursor'

describe('hero robot placement', () => {
  it('places the invisible platform at the intro lower edge within the left column', () => {
    const container = document.createElement('div')
    const leftColumn = document.createElement('div')
    const intro = document.createElement('p')
    intro.textContent = '01 / INTRO'
    const heading = document.createElement('h1')
    const word = document.createElement('span')
    word.className = 'type-reveal-piece'
    word.textContent = 'Vedant'
    heading.appendChild(word)
    leftColumn.appendChild(intro)
    leftColumn.appendChild(heading)
    container.appendChild(leftColumn)
    document.body.appendChild(container)

    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 100,
      right: 1040,
      bottom: 500,
      width: 1000,
      height: 400,
      x: 40,
      y: 100,
      toJSON: () => ({}),
    })

    vi.spyOn(leftColumn, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 100,
      right: 480,
      bottom: 400,
      width: 440,
      height: 300,
      x: 40,
      y: 100,
      toJSON: () => ({}),
    })

    vi.spyOn(intro, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 120,
      right: 120,
      bottom: 136,
      width: 80,
      height: 16,
      x: 40,
      y: 120,
      toJSON: () => ({}),
    })

    vi.spyOn(word, 'getBoundingClientRect').mockReturnValue({
      left: 40,
      top: 152,
      right: 300,
      bottom: 232,
      width: 260,
      height: 80,
      x: 40,
      y: 152,
      toJSON: () => ({}),
    })

    word.style.fontSize = '80px'

    const placement = computeHeroRobotPlacement(heading, container)
    expect(placement).not.toBeNull()
    expect(placement?.height).toBe(116)
    expect(placement?.left).toBe(92)
    expect(placement?.width).toBe(348)
    expect(placement?.top).toBe(36 - 116)

    container.remove()
  })

  it('animates six magnetic particles with press contraction, release burst, and emotion colors', () => {
    expect(interpolateParticleColor(0)).toBe('rgb(0, 229, 255)')
    expect(interpolateParticleColor(1)).toBe('rgb(255, 51, 68)')

    const cursor = createMagneticRobotCursor()
    const overlay = document.querySelector(
      '[data-robot-magnetic-cursor]',
    ) as HTMLElement
    expect(overlay).not.toBeNull()
    expect(overlay.children).toHaveLength(3)

    cursor.setPointer(200, 150)
    cursor.setHover(true)
    cursor.step(100, 0.016, 0, false)
    expect(document.documentElement.getAttribute('data-cursor-robot')).toBe(
      'true',
    )
    expect(overlay.style.opacity).toBe('1')

    cursor.setPressed(true)
    for (let i = 1; i <= 25; i++) {
      cursor.step(100 + i * 16, 0.016, 0, false)
    }
    const firstParticle = overlay.children[0] as HTMLElement
    expect(firstParticle.style.backgroundColor).toBe('rgb(0, 229, 255)')

    cursor.releaseBurst()
    let maxRadius = 0
    for (let i = 1; i <= 20; i++) {
      cursor.step(500 + i * 16, 0.016, 1, false)
      const match = firstParticle.style.transform.match(
        /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/,
      )
      if (match) {
        const px = Number.parseFloat(match[1]) + 1.5
        const py = Number.parseFloat(match[2]) + 1.5
        maxRadius = Math.max(maxRadius, Math.hypot(px - 200, py - 150))
      }
    }
    expect(maxRadius).toBeGreaterThanOrEqual(8)
    expect(maxRadius).toBeLessThanOrEqual(11)
    expect(firstParticle.style.backgroundColor).toBe('rgb(255, 51, 68)')

    cursor.step(1000, 0.016, 0, true)
    expect(overlay.style.opacity).toBe('0')
    expect(document.documentElement.hasAttribute('data-cursor-robot')).toBe(
      false,
    )

    cursor.destroy()
    expect(document.querySelector('[data-robot-magnetic-cursor]')).toBeNull()
  })

  it('rotates 360 degrees around Y-axis via rotateBy while locking position', () => {
    const robot = createRobot()
    const physics = {
      floorAt: () => 0,
      updateSurfaces: () => {},
      dispose: () => {},
    }
    const emotions = createEmotionController({ now: () => 0 })
    const movement = createMovement(robot, physics, emotions, physicsDefaults)

    const initialPos = robot.root.position.toArray()
    movement.rotateBy(Math.PI / 2)
    movement.update(16, 0.016, false)

    const euler = new Euler().setFromQuaternion(
      robot.root.quaternion as Quaternion,
      'YXZ',
    )
    expect(euler.y).toBeCloseTo(Math.PI / 2, 2)
    expect(robot.root.position.toArray()).toEqual(initialPos)

    movement.rotateBy(Math.PI)
    movement.update(32, 0.016, false)
    const euler2 = new Euler().setFromQuaternion(
      robot.root.quaternion as Quaternion,
      'YXZ',
    )
    expect(Math.abs(euler2.y)).toBeCloseTo(Math.PI / 2, 2)
    expect(robot.root.position.toArray()).toEqual(initialPos)
  })
})
