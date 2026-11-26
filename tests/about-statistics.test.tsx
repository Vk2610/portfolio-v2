import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { useCountUp } from '@/animations/useCountUp'
import { technologies } from '@/data/technologies'
import { About } from '@/sections/About'

vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  useReducedMotion: () => true,
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const values = ['10+', '01', String(technologies.length)]

function Counters() {
  const refs = useCountUp(values, true)
  return values.map((value, index) => (
    <span
      key={value}
      ref={(element) => {
        refs.current[index] = element
      }}
    >
      {value}
    </span>
  ))
}

it('stages formatted integer counts and stops after the last value', () => {
  vi.useFakeTimers({
    toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'],
  })
  const { container, unmount } = render(<Counters />)
  const displayed = () =>
    Array.from(container.children).map((element) => element.textContent)
  expect(displayed()).toEqual(['0+', '00', '0'])
  vi.advanceTimersByTime(150)
  expect(displayed()).toEqual(['4+', '00', '0'])
  vi.advanceTimersByTime(1000)
  expect(displayed()).toEqual(values)
  expect(vi.getTimerCount()).toBe(0)
  unmount()

  const pending = render(<Counters />)
  expect(vi.getTimerCount()).toBe(1)
  pending.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

it('shows the final catalog-derived values immediately with reduced motion', () => {
  render(<About />)
  const terms = screen.getAllByRole('term')
  expect(
    terms.map((term) => term.querySelector('[aria-hidden]')?.textContent),
  ).toEqual(values)
  expect(
    terms.map(
      (term) =>
        term.querySelector('span > span:not([aria-hidden])')?.textContent,
    ),
  ).toEqual(values)
})
