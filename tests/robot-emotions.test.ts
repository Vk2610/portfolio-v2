import { describe, expect, it } from 'vitest'
import { createEmotionController } from '../src/features/robot-preview/emotions.js'

function setup() {
  let time = 0
  const controller = createEmotionController({
    now: () => time,
    random: () => 0,
  })
  return {
    controller,
    at: (next: number) => {
      time = next
      return controller.frame()
    },
  }
}

describe('H1 emotion controller', () => {
  it('counts valid taps, extends happiness, then gets angry on tap seven', () => {
    const { controller, at } = setup()
    controller.registerInteraction()
    at(600)
    controller.registerInteraction()
    expect(at(2100).current).toBe('happy')
    for (let i = 3; i <= 6; i++) {
      controller.registerInteraction()
      expect(controller.frame().count).toBe(i)
      expect(controller.getCurrentEmotion()).toBe('happy')
    }
    controller.registerInteraction()
    expect(controller.getCurrentEmotion()).toBe('angry')
    expect(at(5000).count).toBe(0)
    expect(at(5200).current).toBe('neutral')
  })

  it('gives dizzy priority and fades its visual weight back to neutral', () => {
    const { controller, at } = setup()
    controller.registerInteraction()
    at(300)
    controller.triggerDizzy()
    for (let i = 0; i < 8; i++) controller.registerInteraction()
    expect(at(700)).toMatchObject({
      current: 'dizzy',
      previous: 'happy',
      mix: [0, 0, 1, 0],
    })
    expect(at(3300).current).toBe('neutral')
    expect(at(3400).mix[2]).toBeGreaterThan(0)
    expect(at(3600).mix).toEqual([1, 0, 0, 0])
  })

  it('transitions continuously, blinks only at idle, and honors reduced motion', () => {
    const { controller, at } = setup()
    expect(at(3277).blink).toBeLessThan(0.1)
    expect(controller.frame(undefined, true).blink).toBe(1)
    controller.setEmotion('happy')
    const intermediate = at(3377).mix
    expect(intermediate[1]).toBeGreaterThan(0)
    controller.triggerDizzy()
    expect(controller.frame().mix).toEqual(intermediate)
    expect(controller.frame(undefined, true)).toMatchObject({
      mix: [0, 0, 1, 0],
      moving: false,
    })
    controller.resetEmotion()
    expect(at(3700)).toMatchObject({ current: 'neutral', count: 0 })
  })

  it('expires an interaction window and supports configurable timings', () => {
    const { controller, at } = setup()
    controller.configure({
      happy: 500,
      interactionWindow: 1000,
      transition: 150,
    })
    controller.registerInteraction()
    expect(at(150).mix).toEqual([0, 1, 0, 0])
    expect(at(501).current).toBe('neutral')
    expect(at(1001).count).toBe(0)
    controller.registerInteraction()
    expect(controller.frame().count).toBe(1)
  })
})
