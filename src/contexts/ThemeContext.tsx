/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

// skipcq: JS-W1042
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

/**
 * ThemeProvider component that provides theme context to its children.
 * Manages theme state, applies theme classes to the document, and persists
 * the theme in localStorage.
 *
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - Child nodes to render within the provider.
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
   * Toggles the current theme between 'light' and 'dark'.
   *
   * @returns {void}
   */
  const toggleTheme = () => {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  /**
   * Sets the theme to the specified value.
   *
   * @param {Theme} newTheme - The theme to set.
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
 *
 * @returns {ThemeContextType} The current theme context including theme, toggleTheme, and setTheme.
 */
export const useTheme = () => {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
