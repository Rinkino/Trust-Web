import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'midnight' | 'neon' | 'ember' | 'arctic'

const themes: { id: Theme; label: string; color: string }[] = [
  { id: 'midnight', label: 'Midnight', color: '#7c3aed' },
  { id: 'neon',     label: 'Neon',     color: '#10b981' },
  { id: 'ember',    label: 'Ember',    color: '#f97316' },
  { id: 'arctic',   label: 'Arctic',   color: '#0ea5e9' },
]

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  themes: typeof themes
}>({ theme: 'midnight', setTheme: () => {}, themes })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    return (localStorage.getItem('tw-theme') as Theme) || 'midnight'
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
