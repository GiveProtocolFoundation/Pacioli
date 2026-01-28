import type { Translations } from '../types'

export const de: Translations = {
  common: {
    continue: 'Weiter',
    back: 'Zurück',
    cancel: 'Abbrechen',
    save: 'Speichern',
    loading: 'Wird geladen...',
    error: 'Fehler',
    success: 'Erfolg',
  },

  firstLaunch: {
    welcome: 'Willkommen bei Pacioli',
    selectLanguage: 'Sprache Auswählen',
    selectLanguageDesc: 'Wählen Sie Ihre bevorzugte Sprache für die Anwendung.',
    securitySetup: 'Sicherheitseinrichtung',
    securitySetupDesc: 'Wählen Sie, wie Sie Ihre Daten schützen möchten.',
    easyAccess: 'Einfacher Zugang',
    easyAccessDesc:
      'Direkt zum Dashboard ohne Passwort öffnen. Ideal für persönliche Geräte.',
    secureUse: 'Sicher',
    secureUseDesc:
      'Passwort bei jedem Start erforderlich. Empfohlen für gemeinsam genutzte Geräte.',
    securePlus: 'Sicher+',
    securePlusDesc:
      'Passwort beim Start plus automatische Sperre bei Inaktivität. Maximale Sicherheit.',
    setPassword: 'Passwort Festlegen',
    setPasswordDesc:
      'Erstellen Sie ein starkes Passwort zum Schutz Ihrer Daten.',
    confirmPassword: 'Passwort Bestätigen',
    passwordMismatch: 'Passwörter stimmen nicht überein',
    passwordTooShort: 'Passwort muss mindestens 8 Zeichen lang sein',
    sessionTimeout: 'Sitzungs-Timeout',
    sessionTimeoutDesc: 'Nach dieser Inaktivitätsdauer sperren',
    setupComplete: 'Einrichtung Abgeschlossen',
    setupCompleteDesc:
      'Ihre Einstellungen wurden gespeichert. Sie können diese jederzeit in den Einstellungen ändern.',
    getStarted: 'Loslegen',
  },

  recovery: {
    title: 'Wiederherstellungsphrase',
    subtitle:
      'Speichern Sie diese Phrase, um Ihr Konto wiederherzustellen, falls Sie Ihr Passwort vergessen.',
    warning: 'Wichtig',
    warningDesc:
      'Schreiben Sie diese 12 Wörter auf und bewahren Sie sie sicher auf. Dies ist die einzige Möglichkeit, Ihr Konto wiederherzustellen, wenn Sie Ihr Passwort vergessen.',
    copyButton: 'In Zwischenablage kopieren',
    copied: 'Kopiert!',
    confirmCheckbox: 'Ich habe diese Phrase sicher gespeichert',
    word: 'Wort',
    forgotPassword: 'Passwort vergessen?',
    resetTitle: 'Passwort Zurücksetzen',
    resetSubtitle:
      'Geben Sie Ihre 12-Wort-Wiederherstellungsphrase ein, um Ihr Passwort zurückzusetzen.',
    enterPhrase: 'Wiederherstellungsphrase',
    phrasePlaceholder:
      'Geben Sie Ihre 12 Wiederherstellungswörter durch Leerzeichen getrennt ein',
    invalidPhrase:
      'Ungültige Wiederherstellungsphrase. Bitte überprüfen und erneut versuchen.',
    newPassword: 'Neues Passwort',
    confirmNewPassword: 'Neues Passwort bestätigen',
    resetSuccess: 'Passwort erfolgreich zurückgesetzt!',
    resetButton: 'Passwort Zurücksetzen',
    backToLogin: 'Zurück zur Anmeldung',
  },

  unlock: {
    title: 'Willkommen Zurück',
    subtitle: 'Geben Sie Ihr Passwort ein, um Pacioli zu entsperren',
    enterPassword: 'Passwort eingeben',
    unlock: 'Entsperren',
    incorrectPassword: 'Falsches Passwort. Bitte versuchen Sie es erneut.',
    sessionExpired: 'Sitzung Abgelaufen',
    sessionExpiredDesc:
      'Ihre Sitzung ist wegen Inaktivität abgelaufen. Bitte geben Sie Ihr Passwort ein, um fortzufahren.',
    forgotPassword: 'Passwort vergessen?',
  },

  dashboard: {
    title: 'Dashboard',
    welcome: 'Willkommen zurück',
    totalBalance: 'Gesamtguthaben',
    recentTransactions: 'Letzte Transaktionen',
    wallets: 'Wallets',
    noWallets: 'Noch keine Wallets hinzugefügt',
    addWallet: 'Wallet Hinzufügen',
  },

  nav: {
    dashboard: 'Dashboard',
    transactions: 'Transaktionen',
    wallets: 'Wallets',
    entities: 'Entitäten',
    reports: 'Berichte',
    analytics: 'Analytik',
    settings: 'Einstellungen',
    support: 'Support',
    docs: 'Dokumentation',
  },

  settings: {
    title: 'Einstellungen',
    general: 'Allgemein',
    security: 'Sicherheit',
    language: 'Sprache',
    changeLanguage: 'Sprache Ändern',
    changeSecurityMode: 'Sicherheitsmodus Ändern',
    currentMode: 'Aktueller Modus',
    exportData: 'Daten Exportieren',
    importData: 'Daten Importieren',
    about: 'Über',
  },
}
