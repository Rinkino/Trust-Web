import { useEffect, useRef, useState } from 'react'

type Props = {
  value: number
  decimals?: number
  prefix?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export default function AnimatedCounter({ value, decimals = 1, prefix = '' }: Props) {
  const [displayed, setDisplayed] = useState(value)
  const prevValueRef = useRef(value)
  const rafRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const duration = 1200

  useEffect(() => {
    const from = prevValueRef.current
    const to = value
    prevValueRef.current = value

    if (from === to) return

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
    }
    startTimeRef.current = null

    function animate(timestamp: number) {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp
      }
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = easeOutCubic(progress)
      const current = from + (to - from) * eased
      setDisplayed(current)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayed(to)
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [value])

  return (
    <span>
      {prefix}{displayed.toFixed(decimals)}
    </span>
  )
}
