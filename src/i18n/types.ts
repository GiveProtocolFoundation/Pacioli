/**
 * i18n Type Definitions
 */

export type SupportedLanguage =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'zh-CN'
  | 'zh-TW'
  | 'eo'

export interface LanguageInfo {
  code: SupportedLanguage
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'zh-TW', name: 'Chinese (Traditional)', nativeName: '繁體中文' },
  { code: 'eo', name: 'Esperanto', nativeName: 'Esperanto' },
]

export type SecurityMode = 'easy' | 'secure' | 'secure_plus'

export interface Translations {
  // Common
  common: {
    continue: string
    back: string
    cancel: string
    save: string
    loading: string
    error: string
    success: string
  }

  // First Launch
  firstLaunch: {
    welcome: string
    selectLanguage: string
    selectLanguageDesc: string
    securitySetup: string
    securitySetupDesc: string
    easyAccess: string
    easyAccessDesc: string
    secureUse: string
    secureUseDesc: string
    securePlus: string
    securePlusDesc: string
    setPassword: string
    setPasswordDesc: string
    confirmPassword: string
    passwordMismatch: string
    passwordTooShort: string
    sessionTimeout: string
    sessionTimeoutDesc: string
    setupComplete: string
    setupCompleteDesc: string
    getStarted: string
  }

  // Recovery Phrase
  recovery: {
    title: string
    subtitle: string
    warning: string
    warningDesc: string
    copyButton: string
    copied: string
    confirmCheckbox: string
    word: string
    forgotPassword: string
    resetTitle: string
    resetSubtitle: string
    enterPhrase: string
    phrasePlaceholder: string
    invalidPhrase: string
    newPassword: string
    confirmNewPassword: string
    resetSuccess: string
    resetButton: string
    backToLogin: string
  }

  // Unlock Screen
  unlock: {
    title: string
    subtitle: string
    enterPassword: string
    unlock: string
    incorrectPassword: string
    sessionExpired: string
    sessionExpiredDesc: string
    forgotPassword: string
  }

  // Dashboard
  dashboard: {
    title: string
    welcome: string
    totalBalance: string
    recentTransactions: string
    wallets: string
    noWallets: string
    addWallet: string
  }

  // Navigation
  nav: {
    dashboard: string
    transactions: string
    wallets: string
    entities: string
    reports: string
    analytics: string
    settings: string
    support: string
    docs: string
  }

  // Settings
  settings: {
    title: string
    general: string
    security: string
    language: string
    changeLanguage: string
    changeSecurityMode: string
    currentMode: string
    exportData: string
    importData: string
    about: string
  }
}
