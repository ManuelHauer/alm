'use client'

/**
 * IntroAnimation — "NO COOKIES EVER" split-flap display.
 *
 * Plays once per browser session (sessionStorage key `alm-intro-played`).
 * Skippable on tap/click. Disabled via site-settings.introAnimation = false.
 * Respects prefers-reduced-motion: skips the cycling effect, shows text briefly.
 *
 * Flash prevention:
 *   The overlay starts VISIBLE in the initial render (server + client), so the
 *   main page is never exposed before the intro plays. A useLayoutEffect runs
 *   synchronously before the first browser paint: if the intro has already
 *   played (sessionStorage), it hides the overlay immediately (no flash of the
 *   overlay either, since useLayoutEffect fires before paint).
 *
 * Timing (normal):
 *   - Characters cycle ~60ms each (random char set)
 *   - Lock-in from left to right, 110ms apart
 *   - First lock: 300ms · Last lock: 300ms + 14 × 110ms = 1840ms
 *   - Hold 400ms · Fade out 300ms → total ~2540ms ≈ 2.5s
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import styles from './IntroAnimation.module.css'

const TEXT = 'NO COOKIES EVER'
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·-–'
const CYCLE_INTERVAL = 60     // ms between random char swaps
const LOCK_STAGGER = 110      // ms between each character locking in
const FIRST_LOCK_DELAY = 300  // ms before first character locks
const HOLD_AFTER_LOCK = 400   // ms to hold fully-revealed text before fade
const FADE_DURATION = 300     // ms for fade-out (matches CSS transition)

function randomChar() {
  return CHARS[Math.floor(Math.random() * CHARS.length)]
}

type Props = {
  enabled: boolean
}

export default function IntroAnimation({ enabled }: Props) {
  // Start VISIBLE so the overlay is part of the initial SSR HTML — the main
  // page is never shown before this component decides whether to play or hide.
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)
  // letters start as the final text (stable for SSR); randomised client-side
  // before the animation starts.
  const [letters, setLetters] = useState<string[]>(TEXT.split(''))
  const lockedRef = useRef<boolean[]>(TEXT.split('').map(() => false))
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Dismiss immediately on tap/click
  const dismiss = () => {
    timersRef.current.forEach(clearTimeout)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setFading(true)
    timersRef.current.push(
      setTimeout(() => setVisible(false), FADE_DURATION),
    )
  }

  // Hide the overlay synchronously before the first browser paint if it
  // shouldn't be shown. This is the core fix for the "flash of main page".
  useLayoutEffect(() => {
    if (!enabled || sessionStorage.getItem('alm-intro-played')) {
      setVisible(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only — enabled is stable

  // Start the animation. Runs after useLayoutEffect, so if visible was set
  // to false above, this early-returns immediately.
  useEffect(() => {
    if (!enabled) return
    if (sessionStorage.getItem('alm-intro-played')) return
    sessionStorage.setItem('alm-intro-played', '1')

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reducedMotion) {
      setLetters(TEXT.split(''))
      lockedRef.current = TEXT.split('').map(() => true)
      const t1 = setTimeout(() => setFading(true), 800)
      const t2 = setTimeout(() => setVisible(false), 800 + FADE_DURATION)
      timersRef.current = [t1, t2]
      return
    }

    // Randomise letters immediately (client-only, runs before first user paint)
    setLetters(TEXT.split('').map(() => randomChar()))
    lockedRef.current = TEXT.split('').map(() => false)

    // Cycle all characters
    intervalRef.current = setInterval(() => {
      setLetters((prev) =>
        prev.map((ch, i) => (lockedRef.current[i] ? ch : randomChar())),
      )
    }, CYCLE_INTERVAL)

    // Lock characters left to right
    TEXT.split('').forEach((char, i) => {
      const t = setTimeout(() => {
        lockedRef.current[i] = true
        setLetters((prev) => {
          const next = [...prev]
          next[i] = char
          return next
        })
      }, FIRST_LOCK_DELAY + i * LOCK_STAGGER)
      timersRef.current.push(t)
    })

    // Stop cycling after last lock
    const lastLock = FIRST_LOCK_DELAY + (TEXT.length - 1) * LOCK_STAGGER
    const stopT = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }, lastLock + 50)
    timersRef.current.push(stopT)

    // Fade out
    const fadeT = setTimeout(() => setFading(true), lastLock + HOLD_AFTER_LOCK)
    const hideT = setTimeout(() => setVisible(false), lastLock + HOLD_AFTER_LOCK + FADE_DURATION)
    timersRef.current.push(fadeT, hideT)

    return () => {
      timersRef.current.forEach(clearTimeout)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // mount only

  if (!visible) return null

  return (
    <div
      className={`${styles.overlay} ${fading ? styles.fading : ''}`}
      onClick={dismiss}
      role="status"
      aria-live="polite"
      aria-label="No cookies ever"
      suppressHydrationWarning
    >
      <p className={styles.text} aria-hidden="true" suppressHydrationWarning>
        {letters.map((char, i) => (
          <span key={i} className={styles.letter} suppressHydrationWarning>
            {char}
          </span>
        ))}
      </p>
    </div>
  )
}
