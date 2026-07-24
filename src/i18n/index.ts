/**
 * Internationalization (i18n) Module
 * Provides translations for all supported languages
 */

import type { SupportedLanguage, Translations } from './types'
import { en } from './translations/en'
import { es } from './translations/es'
import { fr } from './translations/fr'
import { de } from './translations/de'
import { pt } from './translations/pt'
import { zhCN } from './translations/zh-CN'
import { zhTW } from './translations/zh-TW'
import { eo } from './translations/eo'

export * from './types'

const translations: Record<SupportedLanguage, Translations> = {
  en,
  es,
  fr,
  de,
  pt,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  eo,
}

/**
 * Retrieves the translation mappings for the specified language.
 * @param language - The language code to retrieve translations for.
 * @returns The translation object for the given language, defaulting to English if not available.
 */
export function getTranslations(language: SupportedLanguage): Translations {
  return translations[language] || translations.en
}

/code/b16279e6-fd92-4756-b6f0-8dc46e1cef99/new_code/src/i18n/index.ts

export interface SupportedLanguageMap {
  [key: string]: Record<string, string>
}

export type SupportedLanguage = keyof SupportedLanguageMap

const translations: SupportedLanguageMap = {
  en: {
    greeting: "Hello",
  },
  es: {
    greeting: "Hola",
  },
  zh: {
    greeting: "你好",
  },
  "zh-CN": {
    greeting: "你好",
  },
  "zh-TW": {
    greeting: "你好",
  },
}

/**
 * Detects the user's browser language and returns a supported language code.
 * @returns {SupportedLanguage} The detected or default supported language code.
 */
export function detectBrowserLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') return 'en'

  const browserLang = navigator.language || 'en'

  // Check for exact match first
  if (browserLang in translations) {
    return browserLang as SupportedLanguage
  }

  // Check for language code match (e.g., 'en-US' -> 'en')
  const langCode = browserLang.split('-')[0]
  if (langCode in translations) {
    return langCode as SupportedLanguage
  }

  // Special handling for Chinese variants
  if (browserLang.startsWith('zh')) {
    if (
      browserLang.includes('TW') ||
      browserLang.includes('HK') ||
      browserLang.includes('Hant')
    ) {
      return 'zh-TW'
    }
    return 'zh-CN'
  }

  return 'en'
}
