import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { profile } from '../src/data/profile'
import { Contact } from '../src/sections/Contact'

afterEach(cleanup)

it('keeps copy separate from the contact links and reports clipboard results', async () => {
  const rootStyle = document.documentElement.style
  const resetDuration = rootStyle.getPropertyValue('--copy-reset')
  rootStyle.setProperty('--copy-reset', '1500ms')
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  const writeText = vi
    .fn()
    .mockResolvedValueOnce(undefined)
    .mockRejectedValueOnce(new Error('Permission denied'))
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })

  try {
    render(<Contact />)
    const copy = screen.getByRole('button', { name: 'Copy email address' })
    const email = screen.getByRole('link', { name: /email/i })
    expect(email).toHaveAttribute('href', `mailto:${profile.email}`)
    expect(email).not.toContainElement(copy)
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      profile.github,
    )
    expect(screen.getByRole('link', { name: /linkedin/i })).toHaveAttribute(
      'href',
      profile.linkedin,
    )

    fireEvent.click(copy)
    expect(writeText).toHaveBeenCalledWith(profile.email)
    expect(await screen.findByRole('button', { name: 'Email copied' })).toBe(
      copy,
    )

    fireEvent.click(copy)
    expect(await screen.findByText(/unable to copy/i)).toBeInTheDocument()
    expect(copy).toHaveAccessibleName('Copy email address')
  } finally {
    rootStyle.setProperty('--copy-reset', resetDuration)
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
})

it('ignores stale clipboard results and restarts the success reset after a repeat', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const rootStyle = document.documentElement.style
  const resetDuration = rootStyle.getPropertyValue('--copy-reset')
  rootStyle.setProperty('--copy-reset', '1500ms')
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  let rejectFirst: (reason: Error) => void = () => {}
  const first = new Promise<void>((_, reject) => {
    rejectFirst = reject
  })
  const writeText = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  })

  try {
    const { unmount } = render(<Contact />)
    const copy = screen.getByRole('button', { name: 'Copy email address' })
    const icons = copy.querySelector('[data-copied]')
    expect(icons).toHaveAttribute('aria-hidden', 'true')
    expect(icons?.querySelectorAll('svg')).toHaveLength(2)
    fireEvent.click(copy)
    await act(async () => {
      fireEvent.click(copy)
    })
    expect(copy).toHaveAccessibleName('Email copied')
    expect(icons).toHaveAttribute('data-copied', 'true')
    await act(async () => {
      rejectFirst(new Error('Stale failure'))
    })
    expect(screen.getByRole('status')).toHaveTextContent('Copied')

    act(() => vi.advanceTimersByTime(1000))
    await act(async () => {
      fireEvent.click(copy)
    })
    act(() => vi.advanceTimersByTime(1499))
    expect(copy).toHaveAccessibleName('Email copied')
    act(() => vi.advanceTimersByTime(1))
    expect(copy).toHaveAccessibleName('Copy email address')
    expect(icons).toHaveAttribute('data-copied', 'false')

    await act(async () => {
      fireEvent.click(copy)
    })
    const timerCount = vi.getTimerCount()
    unmount()
    expect(vi.getTimerCount()).toBeLessThan(timerCount)
  } finally {
    rootStyle.setProperty('--copy-reset', resetDuration)
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
    vi.useRealTimers()
  }
})
