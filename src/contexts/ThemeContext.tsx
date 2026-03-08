/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * ThemeProvider component that wraps its children and provides theme context.
 * @param {object} props - Component properties.
 * @param {React.ReactNode} props.children - Child components that will have access to the theme context.
 * @returns {JSX.Element} The ThemeProvider component.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
      return savedTheme
    }

    // Check system preference
    if (
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    ) {
      return 'dark'
    }

    return 'light'
  })

  useEffect(() => {
    const root = document.documentElement

    // Remove previous theme class
    root.classList.remove('light', 'dark')

    // Add current theme class
    root.classList.add(theme)

    // Save to localStorage
    localStorage.setItem('theme', theme)
  }, [theme])

  /**
   * Toggles between 'light' and 'dark' themes.
   * @returns {void}
   */
  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  /**
   * Sets the theme to a specified value.
   * @param {Theme} newTheme - The new theme to set.
   * @returns {void}
   */
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/**
 * Custom hook to access the theme context.
 * @returns {ThemeContextType} The current theme context.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
