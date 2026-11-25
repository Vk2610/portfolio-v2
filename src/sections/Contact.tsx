import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Copy, Mail, MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Section } from '@/components/layout/Section'
import { SectionDivider } from '@/components/common/SectionDivider'
import { staggeredEntrance } from '@/animations/variants'
import { motionMilliseconds } from '@/animations/transitions'
import { profile } from '@/data/profile'

const rowGrid =
  'grid w-full grid-cols-[24px_minmax(0,1fr)_24px_24px] items-center gap-x-4'

export function Contact() {
  const reduced = useReducedMotion() ?? false
  const heading = staggeredEntrance('fade-up', reduced)
  const rows = staggeredEntrance('elements', reduced)
  const [status, setStatus] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const attempt = useRef(0)
  useEffect(
    () => () => {
      clearTimeout(timer.current)
      attempt.current++
    },
    [],
  )

  async function copyEmail() {
    const current = ++attempt.current
    clearTimeout(timer.current)
    setStatus('')
    try {
      await navigator.clipboard.writeText(profile.email)
      if (current !== attempt.current) return
      setStatus('Copied')
      timer.current = setTimeout(
        () => setStatus(''),
        motionMilliseconds('--copy-reset'),
      )
    } catch {
      if (current === attempt.current)
        setStatus(
          'Unable to copy. Select the email address to copy it manually.',
        )
    }
  }

  const linkClass =
    'group min-w-0 items-center py-6 text-secondary transition-colors duration-(--duration-normal) hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none'
  const arrow = (
    <ArrowUpRight
      aria-hidden
      size={18}
      strokeWidth={1.5}
      className="col-start-4 row-start-1 shrink-0 justify-self-end transition-transform duration-(--duration-normal) group-hover:translate-x-[3px] group-hover:-translate-y-[3px] group-focus-visible:translate-x-[3px] group-focus-visible:-translate-y-[3px] motion-reduce:transform-none motion-reduce:transition-none"
    />
  )

  return (
    <Section
      id="contact"
      aria-labelledby="contact-heading"
      className="scroll-mt-(--navbar-height)"
    >
      <SectionDivider />
      <div className="grid gap-10 py-8 desktop:grid-cols-2">
        <motion.div
          variants={heading.group}
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.p variants={heading.item} className="type-mono text-muted">
            06 / CONTACT
          </motion.p>
          <motion.h2
            variants={heading.item}
            id="contact-heading"
            className="type-h2 mt-7"
          >
            Good things start with a conversation.
          </motion.h2>
          <motion.p
            variants={heading.item}
            className="mt-4 max-w-[55ch] text-secondary"
          >
            I'm open to new opportunities, meaningful collaborations and
            interesting projects. Let's connect and see what we can build
            together.
          </motion.p>
          <motion.div variants={heading.item} className="mt-8 text-secondary">
            <p className="type-mono text-muted">BASED IN</p>
            <p className="mt-2 flex items-center gap-3">
              <MapPin size={24} strokeWidth={1.5} aria-hidden />
              {profile.contactLocation}
            </p>
          </motion.div>
        </motion.div>
        <motion.div
          variants={rows.group}
          initial={reduced ? false : 'hidden'}
          whileInView="visible"
          viewport={{ once: true }}
        >
          <motion.div
            variants={rows.item}
            className={`${rowGrid} border-b border-line-subtle`}
          >
            <a
              href={`mailto:${profile.email}`}
              className={`${linkClass} ${rowGrid} col-span-full col-start-1 row-start-1`}
            >
              <Mail
                size={24}
                strokeWidth={1.5}
                className="shrink-0"
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block text-lg font-medium">Email</span>
                <span className="type-mono mt-2 block break-words">
                  {profile.email}
                </span>
              </span>
              {arrow}
            </a>
            <button
              type="button"
              aria-label={
                status === 'Copied' ? 'Email copied' : 'Copy email address'
              }
              onClick={copyEmail}
              className="control-target z-10 col-start-3 row-start-1 grid place-items-center justify-self-center text-secondary transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none"
            >
              {status === 'Copied' ? (
                <Check size={18} strokeWidth={1.5} aria-hidden />
              ) : (
                <Copy size={18} strokeWidth={1.5} aria-hidden />
              )}
            </button>
          </motion.div>
          {[
            {
              title: 'GitHub',
              metadata: 'github.com/Vk2610',
              href: profile.github,
              icon: (
                <img
                  src={`${import.meta.env.BASE_URL}icons/technologies/github.svg`}
                  width={24}
                  height={24}
                  alt=""
                  className="shrink-0"
                />
              ),
            },
            {
              title: 'LinkedIn',
              metadata: 'Connect professionally',
              href: profile.linkedin,
              icon: (
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  width={24}
                  height={24}
                  className="shrink-0"
                  aria-hidden
                >
                  <path d="M6.5 8.5H3V21h3.5zM4.75 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4M21 13.5c0-3.4-1.8-5-4.2-5-1.8 0-2.6 1-3.1 1.7V8.5h-3.5V21h3.5v-7c0-1.8.8-2.5 2-2.5s1.8.8 1.8 2.5v7H21z" />
                </svg>
              ),
            },
          ].map((social) => (
            <motion.div
              key={social.title}
              variants={rows.item}
              className="border-b border-line-subtle"
            >
              <a
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${linkClass} underline-reveal block w-full font-medium`}
              >
                <span data-underline-label className={rowGrid}>
                  {social.icon}
                  <span className="min-w-0">
                    <span className="block text-lg">{social.title}</span>
                    <span className="type-mono mt-2 block">
                      {social.metadata}
                    </span>
                  </span>
                  {arrow}
                </span>
              </a>
            </motion.div>
          ))}
          <p role="status" className="type-mono min-h-9 pt-2 text-muted">
            {status}
          </p>
        </motion.div>
      </div>
      <SectionDivider />
    </Section>
  )
}
