import { createContext, useContext, useEffect, useState } from 'react'

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
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
