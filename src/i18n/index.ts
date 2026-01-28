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

export function getTranslations(language: SupportedLanguage): Translations {
  return translations[language] || translations.en
}

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
