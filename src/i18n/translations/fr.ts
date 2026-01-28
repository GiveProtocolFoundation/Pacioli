import type { Translations } from '../types'

export const fr: Translations = {
  common: {
    continue: 'Continuer',
    back: 'Retour',
    cancel: 'Annuler',
    save: 'Enregistrer',
    loading: 'Chargement...',
    error: 'Erreur',
    success: 'Succès',
  },

  firstLaunch: {
    welcome: 'Bienvenue sur Pacioli',
    selectLanguage: 'Sélectionner la Langue',
    selectLanguageDesc: "Choisissez votre langue préférée pour l'application.",
    securitySetup: 'Configuration de la Sécurité',
    securitySetupDesc:
      'Choisissez comment vous souhaitez protéger vos données.',
    easyAccess: 'Accès Facile',
    easyAccessDesc:
      'Ouvrir directement le tableau de bord sans mot de passe. Idéal pour les appareils personnels.',
    secureUse: 'Sécurisé',
    secureUseDesc:
      'Mot de passe requis à chaque lancement. Recommandé pour les appareils partagés.',
    securePlus: 'Sécurisé+',
    securePlusDesc:
      'Mot de passe au lancement plus verrouillage automatique après inactivité. Sécurité maximale.',
    setPassword: 'Définir le Mot de Passe',
    setPasswordDesc: 'Créez un mot de passe fort pour protéger vos données.',
    confirmPassword: 'Confirmer le Mot de Passe',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
    passwordTooShort: 'Le mot de passe doit contenir au moins 8 caractères',
    sessionTimeout: 'Délai de Session',
    sessionTimeoutDesc: "Verrouiller après cette période d'inactivité",
    setupComplete: 'Configuration Terminée',
    setupCompleteDesc:
      'Vos préférences ont été enregistrées. Vous pouvez les modifier à tout moment dans les Paramètres.',
    getStarted: 'Commencer',
  },

  recovery: {
    title: 'Phrase de Récupération',
    subtitle:
      'Sauvegardez cette phrase pour récupérer votre compte si vous oubliez votre mot de passe.',
    warning: 'Important',
    warningDesc:
      "Notez ces 12 mots et conservez-les en lieu sûr. C'est le seul moyen de récupérer votre compte si vous oubliez votre mot de passe.",
    copyButton: 'Copier dans le presse-papiers',
    copied: 'Copié !',
    confirmCheckbox: "J'ai sauvegardé cette phrase en lieu sûr",
    word: 'Mot',
    forgotPassword: 'Mot de passe oublié ?',
    resetTitle: 'Réinitialiser le Mot de Passe',
    resetSubtitle:
      'Entrez votre phrase de récupération de 12 mots pour réinitialiser votre mot de passe.',
    enterPhrase: 'Phrase de Récupération',
    phrasePlaceholder:
      'Entrez vos 12 mots de récupération séparés par des espaces',
    invalidPhrase:
      'Phrase de récupération invalide. Veuillez vérifier et réessayer.',
    newPassword: 'Nouveau Mot de Passe',
    confirmNewPassword: 'Confirmer le Nouveau Mot de Passe',
    resetSuccess: 'Mot de passe réinitialisé avec succès !',
    resetButton: 'Réinitialiser le Mot de Passe',
    backToLogin: 'Retour à la connexion',
  },

  unlock: {
    title: 'Bon Retour',
    subtitle: 'Entrez votre mot de passe pour déverrouiller Pacioli',
    enterPassword: 'Entrer le mot de passe',
    unlock: 'Déverrouiller',
    incorrectPassword: 'Mot de passe incorrect. Veuillez réessayer.',
    sessionExpired: 'Session Expirée',
    sessionExpiredDesc:
      "Votre session a expiré en raison d'inactivité. Veuillez entrer votre mot de passe pour continuer.",
    forgotPassword: 'Mot de passe oublié ?',
  },

  dashboard: {
    title: 'Tableau de Bord',
    welcome: 'Bon retour',
    totalBalance: 'Solde Total',
    recentTransactions: 'Transactions Récentes',
    wallets: 'Portefeuilles',
    noWallets: 'Aucun portefeuille ajouté',
    addWallet: 'Ajouter un Portefeuille',
  },

  nav: {
    dashboard: 'Tableau de Bord',
    transactions: 'Transactions',
    wallets: 'Portefeuilles',
    entities: 'Entités',
    reports: 'Rapports',
    analytics: 'Analytique',
    settings: 'Paramètres',
    support: 'Support',
    docs: 'Documentation',
  },

  settings: {
    title: 'Paramètres',
    general: 'Général',
    security: 'Sécurité',
    language: 'Langue',
    changeLanguage: 'Changer de Langue',
    changeSecurityMode: 'Changer le Mode de Sécurité',
    currentMode: 'Mode Actuel',
    exportData: 'Exporter les Données',
    importData: 'Importer les Données',
    about: 'À Propos',
  },
}
