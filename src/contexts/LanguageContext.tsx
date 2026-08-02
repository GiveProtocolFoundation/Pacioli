/* eslint-disable react-refresh/only-export-components */
/**
 * Language Context
 * Provides internationalization support throughout the app
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import {
  getTranslations,
  detectBrowserLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
  type Translations,
  type LanguageInfo,
} from '../i18n'
import { storage } from '../services/storage'

interface LanguageContextValue {
  language: SupportedLanguage
  setLanguage: (lang: SupportedLanguage) => Promise<void>
  t: Translations
  languages: LanguageInfo[]
  isLoading: boolean
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

const LANGUAGE_SETTING_KEY = 'app_language'

/**
 * Provides language context to child components.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The child components to render within the provider.
 * @returns {JSX.Element} The LanguageProvider component wrapping children with context.
 */
export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>('en')
  const [isLoading, setIsLoading] = useState(true)

  // Load saved language on mount
  useEffect(() => {
    /**
     * Loads the saved language from storage or falls back to browser detection.
     * @returns {Promise<void>} A promise that resolves when the language is loaded and state is set.
     */
    const loadLanguage = async () => {
      try {
        const savedLanguage = await storage.getSetting(LANGUAGE_SETTING_KEY)
        if (savedLanguage && isValidLanguage(savedLanguage)) {
          setLanguageState(savedLanguage as SupportedLanguage)
        } else {
          // Use browser language detection for first-time users
          const detectedLang = detectBrowserLanguage()
          setLanguageState(detectedLang)
        }
      } catch (error) {
        console.error('Failed to load language setting:', error)
        // Fall back to browser detection
        setLanguageState(detectBrowserLanguage())
      } finally {
        setIsLoading(false)
      }
    }

    loadLanguage()
  }, [])

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    try {
      await storage.setSetting(LANGUAGE_SETTING_KEY, lang)
      setLanguageState(lang)
    } catch (error) {
      console.error('Failed to save language setting:', error)
      // Still update the UI even if persistence fails
      setLanguageState(lang)
    }
  }, [])

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t: getTranslations(language),
      languages: SUPPORTED_LANGUAGES,
      isLoading,
    }),
    [language, setLanguage, isLoading]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

/**
 * Custom hook to retrieve the current LanguageContextValue.
 *
 * @returns {LanguageContextValue} The current language context value.
 */
export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}

/**
 * Checks if the provided language code is a supported language.
 * @param lang The language code to validate.
 * @returns True if the given lang is a SupportedLanguage, false otherwise.
 */
function isValidLanguage(lang: string): lang is SupportedLanguage {
  return SUPPORTED_LANGUAGES.some(l => l.code === lang)
}

export default LanguageContext
