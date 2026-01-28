'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useState, ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextType {
  theme: Theme
  resolvedTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

const THEME_STORAGE_KEY = 'luseed-theme'

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored
  }
  return 'light'
}

interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(defaultTheme)
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light')
  const [mounted, setMounted] = useState(false)

  // Initialize theme from storage on mount
  useEffect(() => {
    void (async () => {
      const stored = getStoredTheme()
      setThemeState(stored)
      setMounted(true)
    })()
  }, [])

  // Update resolved theme and apply to document
  useLayoutEffect(() => {
    if (!mounted) return

    void (async () => {
      const resolved = theme === 'system' ? getSystemTheme() : theme
      setResolvedTheme(resolved)

      // Apply theme to document
      document.documentElement.setAttribute('data-theme', resolved)

      // Also update the class for Tailwind dark mode if needed
      if (resolved === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    })()
  }, [theme, mounted])

  // Listen for system theme changes
  useEffect(() => {
    if (!mounted || theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      const newResolved = getSystemTheme()
      setResolvedTheme(newResolved)
      document.documentElement.setAttribute('data-theme', newResolved)

      if (newResolved === 'dark') {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme, mounted])

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
    localStorage.setItem(storageKey, newTheme)
  }

  const toggleTheme = () => {
    const newTheme = resolvedTheme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  // Prevent flash of incorrect theme
  if (!mounted) {
    return (
      <ThemeContext.Provider
        value={{
          theme: defaultTheme,
          resolvedTheme: 'light',
          setTheme: () => {},
          toggleTheme: () => {},
        }}
      >
        {children}
      </ThemeContext.Provider>
    )
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// Default values for when context is not available (SSR or outside provider)
const defaultThemeContextValue: ThemeContextType = {
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
}

export function useTheme() {
  const context = useContext(ThemeContext)
  // Return default values if outside provider (SSR safety)
  if (context === undefined) {
    return defaultThemeContextValue
  }
  return context
}

// Theme toggle button component
import { Moon, Sun, Monitor } from 'lucide-react'

interface ThemeToggleProps {
  showLabel?: boolean
  className?: string
}

export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center gap-2 p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors ${className}`}
      title={resolvedTheme === 'light' ? '다크 모드로 전환' : '라이트 모드로 전환'}
    >
      {resolvedTheme === 'light' ? (
        <Moon className="w-5 h-5" />
      ) : (
        <Sun className="w-5 h-5" />
      )}
      {showLabel && (
        <span className="text-sm">
          {resolvedTheme === 'light' ? '다크 모드' : '라이트 모드'}
        </span>
      )}
    </button>
  )
}

// Theme selector with all options (light, dark, system)
interface ThemeSelectorProps {
  className?: string
}

export function ThemeSelector({ className = '' }: ThemeSelectorProps) {
  const { theme, setTheme } = useTheme()

  const options: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: '라이트', icon: Sun },
    { value: 'dark', label: '다크', icon: Moon },
    { value: 'system', label: '시스템', icon: Monitor },
  ]

  return (
    <div className={`flex items-center gap-1 p-1 bg-[var(--bg-tertiary)] rounded-lg ${className}`}>
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setTheme(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors ${
            theme === value
              ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-sm'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}
