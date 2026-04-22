import { createContext, useContext, useEffect, useState } from 'react'

const DRAGON_SVG = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 260"><g fill="${color}"><path d="M199.02,231.09c-13.25-57.48-90.49-86.23-108.58-107.12c-9.3-10.74-6.97-22.15-1.16-28.29c6.24-6.58,18.13-7.88,27-2.09c7.76,5.05,22.86,19.06,26.25,24.23c3.39,5.16,3.35,9.43,5.17,12.9c2.07,3.9,6.75,5.98,13.53,3.95c6.28-1.87,9.75-4.35,9.75-4.35s-6.56-0.25-9.16-3.94c0,0-9.1-19.95-12.36-28.11c10.43,2.77,17.05,5.97,21.68,8.89c0.57,4.44-1.32,12.09-1.4,12.43c0.21-0.12,3.58-2.11,8.59-7.1c0.25,0.21,0.5,0.41,0.74,0.6c1.77,1.41-1.49,12.56-1.49,12.56s6.12-4.11,10.8-9.67c4.05-4.79,7.46-10.87,7.46-10.87s-13.25-5.6-19.36-15.3c-6.13-9.69-0.79-20.21-0.79-20.21s-10.22-3.28-18.78-15.62c-9-12.98-5.52-28.93-5.52-28.93c-7.32,2.94-13.74,17.5-13.74,17.5s-18.49-9.87-42.51-6.8C73.47,35.69,53.33,22.55,44.97,1.8c0,0-6.47,28.39,18.04,46.26c-1.33,0.9-2.66,1.85-3.99,2.87c-11.96,6.81-27.15,6.41-38.85-1.79c0,0,0.62,4.26,2.9,9.38c2.28,5.11,6.21,11.09,12.84,14.53c0.71,0.37,1.41,0.67,2.1,0.93c-1.38,2.2-2.66,4.48-3.81,6.82C27.67,91.76,14.56,97.3,2,94.02c0,0,6.59,12.03,18.41,13.5c2.73,0.34,5.11-0.07,7.15-0.88c-0.1,4.98,0.15,9.64,0.71,14.06c-0.3,9.68-6.83,18.27-16.35,20.99h-0.01c0,0,9.18,5.46,17.68,1.78c1.66-0.72,2.94-1.7,3.93-2.79c6.98,16.86,19.64,30.46,35.78,45.97c4.33,4.17,9.19,8.63,14.12,13.28c48.5,2.8,85.22,24.51,116.32,57.87C200.72,250.56,201.44,241.58,199.02,231.09z"/><path d="M147.91,70.11l13.72,13.65l-21.9-7.9L147.91,70.11z"/><path d="M181.003,133.297c0,0,6.706,6.836,16.005,8.195c-0.628,3.718-1.577,5.572-1.577,5.572s15.96,12.85,35.508,4.572c-0.902,10.276-13.643,14.81-13.643,14.81S230.983,183.407,258,173c-14.657,19.075-36.539,13.759-49.848,6.944C196.19,173.819,180.788,155.727,181.003,133.297z"/></g></svg>`

function setFavicon(color: string) {
  const url = `data:image/svg+xml,${encodeURIComponent(DRAGON_SVG(color))}`
  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="apple-touch-icon"]')
    .forEach(el => { el.href = url })
  // Update theme-color for iOS Safari + Android Chrome toolbar/status bar
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach(el => { el.content = color })
  // Update manifest theme_color for Android PWA / add-to-homescreen
  const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (manifest) {
    const blob = new Blob(
      [JSON.stringify({ name: 'TrustWeb', short_name: 'TrustWeb', start_url: '/', display: 'browser', background_color: '#060810', theme_color: color, icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }] })],
      { type: 'application/json' }
    )
    manifest.href = URL.createObjectURL(blob)
  }
}

export type Theme =
  | 'midnight' | 'neon' | 'arctic'
  | 'crimson' | 'gold' | 'sunset' | 'rose'
  | 'violet' | 'cobalt' | 'teal' | 'slate'

const themes: { id: Theme; label: string; color: string }[] = [
  { id: 'midnight', label: 'Midnight', color: '#7c3aed' },
  { id: 'violet',   label: 'Violet',   color: '#8b5cf6' },
  { id: 'cobalt',   label: 'Cobalt',   color: '#3b82f6' },
  { id: 'arctic',   label: 'Arctic',   color: '#0ea5e9' },
  { id: 'teal',     label: 'Teal',     color: '#14b8a6' },
  { id: 'neon',     label: 'Neon',     color: '#10b981' },
  { id: 'crimson',  label: 'Crimson',  color: '#dc2626' },
  { id: 'rose',     label: 'Rose',     color: '#ec4899' },
  { id: 'sunset',   label: 'Sunset',   color: '#f97316' },
  { id: 'gold',     label: 'Gold',     color: '#f59e0b' },
  { id: 'slate',    label: 'Slate',    color: '#94a3b8' },
]

const VALID_THEMES = new Set(themes.map(t => t.id))

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  themes: typeof themes
}>({ theme: 'slate', setTheme: () => { }, themes })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem('tw-theme') as Theme
    return VALID_THEMES.has(stored) ? stored : 'slate'
  })

  function setTheme(t: Theme) {
    setThemeState(t)
    localStorage.setItem('tw-theme', t)
    document.documentElement.setAttribute('data-theme', t)
    const color = themes.find(th => th.id === t)?.color ?? '#a855f7'
    setFavicon(color)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    const color = themes.find(t => t.id === theme)?.color ?? '#a855f7'
    setFavicon(color)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
