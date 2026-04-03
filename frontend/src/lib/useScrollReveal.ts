import { useEffect, useRef } from 'react'

export function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.disconnect()
        }
      },
      { threshold }
    )

    el.style.opacity = '0'
    el.style.transform = 'translateY(32px)'
    el.style.transition = 'opacity 0.7s ease, transform 0.7s ease'

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}
