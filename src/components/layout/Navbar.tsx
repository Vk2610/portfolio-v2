import { useEffect, useRef, useState } from 'react'
import { profile } from '@/data/profile'
import { TextLink } from '@/components/ui/TextLink'
import { Container } from './Container'
import './navbar.css'

const links = [
  ['About', '#about'],
  ['Stack', '#stack'],
  ['Experience', '#experience'],
  ['Work', '#work'],
  ['Contact', '#contact'],
]

function NavigationLinks({ onSelect }: { onSelect?: () => void }) {
  return links.map(([label, href]) => (
    <li key={href}>
      <TextLink href={href} onClick={onSelect}>
        {label}
      </TextLink>
    </li>
  ))
}

export function Navbar() {
  const [open, setOpen] = useState(false)
  const toggle = useRef<HTMLButtonElement>(null)

  function closeMenu() {
    setOpen(false)
    toggle.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu()
    }

    function onResize() {
      if (toggle.current && getComputedStyle(toggle.current).display === 'none')
        setOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 border-b border-line-subtle bg-background">
      <Container className="flex min-h-(--navbar-content-height) items-center justify-between gap-4">
        <TextLink href="#top" onClick={open ? closeMenu : undefined}>
          {profile.name}
        </TextLink>
        <nav aria-label="Primary" className="hidden tablet:block">
          <ul className="flex items-center gap-6">
            <NavigationLinks />
          </ul>
        </nav>
        <button
          ref={toggle}
          type="button"
          className="control-target grid shrink-0 cursor-pointer place-items-center rounded-md border border-line hover:border-line-hover hover:bg-hover tablet:hidden"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          onClick={() => setOpen(!open)}
        >
          <span className="menu-glyph" data-open={open} aria-hidden="true" />
        </button>
      </Container>
      <nav
        id="mobile-navigation"
        aria-label="Mobile primary"
        inert={!open}
        data-open={open}
        className="mobile-navigation absolute inset-x-0 top-full grid bg-background tablet:hidden"
      >
        <div className="min-h-0 overflow-hidden">
          <Container className="max-h-[calc(100dvh-4rem)] overflow-y-auto">
            <ul className="grid gap-1 border-b border-line-subtle py-4">
              <NavigationLinks onSelect={closeMenu} />
            </ul>
          </Container>
        </div>
      </nav>
    </header>
  )
}
