import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
