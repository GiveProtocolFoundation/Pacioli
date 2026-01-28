/**
 * First Launch Wizard
 * Guides users through initial setup: language selection, security mode, and recovery phrase
 */

import React, { useState, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'
import { storage } from '../../services/storage'
import { RecoveryPhraseDisplay } from '../security'
import type { SecurityMode, SupportedLanguage } from '../../i18n'

interface FirstLaunchProps {
  onComplete: () => void
}

type Step = 'language' | 'security' | 'password' | 'recovery' | 'complete'

const SESSION_TIMEOUT_OPTIONS = [
  { value: 5, label: '5 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '1 hour' },
]

interface LanguageButtonProps {
  lang: { code: SupportedLanguage; name: string; nativeName: string }
  isSelected: boolean
  onSelect: (code: SupportedLanguage) => void
}

interface TimeoutButtonProps {
  value: number
  label: string
  isSelected: boolean
  onSelect: (value: number) => void
}

interface SecurityModeButtonProps {
  mode: SecurityMode
  isSelected: boolean
  onSelect: (mode: SecurityMode) => void
  title: string
  description: string
}

/**
 * Button component for security mode selection in the first launch wizard.
 */
const SecurityModeButton: React.FC<SecurityModeButtonProps> = ({
  mode,
  isSelected,
  onSelect,
  title,
  description,
}) => {
  const handleClick = useCallback(() => {
    onSelect(mode)
  }, [mode, onSelect])

  return (
    <button
      onClick={handleClick}
      className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
        isSelected
          ? 'border-[#8b4e52] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
          : 'border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.3)]'
      }`}
    >
      <div className="flex items-start">
        <div className="flex-shrink-0 mt-0.5">
          <div
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
              isSelected
                ? 'border-[#8b4e52] bg-[#8b4e52]'
                : 'border-[rgba(201,169,97,0.3)] dark:border-[rgba(201,169,97,0.4)]'
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
        <div className="ml-3">
          <h3 className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">{title}</h3>
          <p className="text-sm text-[#a39d94] dark:text-[#8b8580] mt-1">{description}</p>
        </div>
      </div>
    </button>
  )
}

/**
 * Button component for session timeout selection.
 */
const TimeoutButton: React.FC<TimeoutButtonProps> = ({ value, label, isSelected, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(value)
  }, [value, onSelect])

  return (
    <button
      onClick={handleClick}
      className={`flex-1 py-2 px-3 rounded-lg border transition-colors text-sm ${
        isSelected
          ? 'border-[#8b4e52] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20 text-[#8b4e52] dark:text-[#a86e72]'
          : 'border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620]'
      }`}
    >
      {label}
    </button>
  )
}

/**
 * Button component for language selection in the first launch wizard.
 */
const LanguageButton: React.FC<LanguageButtonProps> = ({ lang, isSelected, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect(lang.code)
  }, [lang.code, onSelect])

  return (
    <button
      key={lang.code}
      onClick={handleClick}
      className={`w-full px-4 py-3 rounded-lg border-2 transition-all text-left flex items-center justify-between ${
        isSelected
          ? 'border-[#8b4e52] bg-[#8b4e52]/10 dark:bg-[#8b4e52]/20'
          : 'border-[rgba(201,169,97,0.15)] hover:border-[rgba(201,169,97,0.3)]'
      }`}
    >
      <div>
        <span className="font-medium text-[#1a1815] dark:text-[#f5f3f0]">
          {lang.nativeName}
        </span>
        {lang.code !== 'en' && lang.nativeName !== lang.name && (
          <span className="ml-2 text-sm text-[#a39d94] dark:text-[#8b8580]">
            ({lang.name})
          </span>
        )}
      </div>
      {isSelected && (
        <svg className="w-5 h-5 text-[#8b4e52]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )}
    </button>
  )
}

/**
 * First launch wizard component that guides users through initial setup
 * including language selection, security mode configuration, and password setup.
 */
export const FirstLaunch: React.FC<FirstLaunchProps> = ({ onComplete }) => {
  const { language, setLanguage, t, languages } = useLanguage()

  const [step, setStep] = useState<Step>('language')
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>(language)
  const [securityMode, setSecurityMode] = useState<SecurityMode>('easy')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [sessionTimeout, setSessionTimeout] = useState(15)
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleLanguageSelect = useCallback(async (lang: SupportedLanguage) => {
    setSelectedLanguage(lang)
    await setLanguage(lang)
  }, [setLanguage])

  const handleLanguageContinue = useCallback(() => {
    setStep('security')
  }, [])

  const handleSecuritySelect = useCallback((mode: SecurityMode) => {
    setSecurityMode(mode)
    setError(null)
  }, [])

  const handleSecurityContinue = useCallback(() => {
    if (securityMode === 'easy') {
      // No password needed, go directly to complete
      setStep('complete')
    } else {
      // Need to set password
      setStep('password')
    }
  }, [securityMode])

  const handlePasswordSubmit = useCallback(async () => {
    setError(null)

    // Validate password
    if (password.length < 8) {
      setError(t.firstLaunch.passwordTooShort)
      return
    }

    if (password !== confirmPassword) {
      setError(t.firstLaunch.passwordMismatch)
      return
    }

    setIsSubmitting(true)
    try {
      // Set the password and get recovery phrase
      const phrase = await storage.setPassword(password)
      setRecoveryPhrase(phrase)
      setStep('recovery')
    } catch (err) {
      console.error('Failed to set password:', err)
      setError(err instanceof Error ? err.message : 'Failed to set password')
    } finally {
      setIsSubmitting(false)
    }
  }, [password, confirmPassword, t])

  const handleRecoveryConfirm = useCallback(() => {
    setStep('complete')
  }, [])

  const handlePasswordInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    []
  )

  const handleConfirmPasswordInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmPassword(e.target.value)
    },
    []
  )

  const handleGoToLanguage = useCallback(() => {
    setStep('language')
  }, [])

  const handleGoToSecurity = useCallback(() => {
    setStep('security')
  }, [])

  const handleGoToPassword = useCallback(() => {
    setStep('password')
  }, [])

  const handleComplete = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // Save security mode setting
      await storage.setSetting('security_mode', securityMode)

      // Save session timeout if secure+ mode
      if (securityMode === 'secure_plus') {
        await storage.setSetting('session_timeout_minutes', sessionTimeout.toString())
      }

      // Mark setup as complete
      await storage.setSetting('setup_complete', 'true')

      onComplete()
    } catch (err) {
      console.error('Failed to complete setup:', err)
      setError(err instanceof Error ? err.message : 'Failed to complete setup')
    } finally {
      setIsSubmitting(false)
    }
  }, [securityMode, sessionTimeout, onComplete])

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fafaf8] to-[#ede8e0] dark:from-[#0f0e0c] dark:to-[#1a1815] flex items-center justify-center p-4">
      <div className="bg-[#fafaf8] dark:bg-[#1a1815] rounded-2xl shadow-xl max-w-lg w-full p-8">
        {/* Step: Language Selection */}
        {step === 'language' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#8b4e52]/20 dark:bg-[#8b4e52]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#8b4e52] dark:text-[#a86e72]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                {t.firstLaunch.welcome}
              </h1>
              <p className="text-[#696557] dark:text-[#b8b3ac]">
                {t.firstLaunch.selectLanguageDesc}
              </p>
            </div>

            <div className="space-y-2 mb-8 max-h-80 overflow-y-auto">
              {languages.map((lang) => (
                <LanguageButton
                  key={lang.code}
                  lang={lang}
                  isSelected={selectedLanguage === lang.code}
                  onSelect={handleLanguageSelect}
                />
              ))}
            </div>

            <button
              onClick={handleLanguageContinue}
              className="w-full py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors"
            >
              {t.common.continue}
            </button>
          </>
        )}

        {/* Step: Security Mode Selection */}
        {step === 'security' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#7a9b6f]/20 dark:bg-[#7a9b6f]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#7a9b6f] dark:text-[#8faf84]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                {t.firstLaunch.securitySetup}
              </h1>
              <p className="text-[#696557] dark:text-[#b8b3ac]">
                {t.firstLaunch.securitySetupDesc}
              </p>
            </div>

            <div className="space-y-3 mb-8">
              <SecurityModeButton
                mode="easy"
                isSelected={securityMode === 'easy'}
                onSelect={handleSecuritySelect}
                title={t.firstLaunch.easyAccess}
                description={t.firstLaunch.easyAccessDesc}
              />
              <SecurityModeButton
                mode="secure"
                isSelected={securityMode === 'secure'}
                onSelect={handleSecuritySelect}
                title={t.firstLaunch.secureUse}
                description={t.firstLaunch.secureUseDesc}
              />
              <SecurityModeButton
                mode="secure_plus"
                isSelected={securityMode === 'secure_plus'}
                onSelect={handleSecuritySelect}
                title={t.firstLaunch.securePlus}
                description={t.firstLaunch.securePlusDesc}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleGoToLanguage}
                className="flex-1 py-3 px-4 border border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] font-medium rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
              >
                {t.common.back}
              </button>
              <button
                onClick={handleSecurityContinue}
                className="flex-1 py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors"
              >
                {t.common.continue}
              </button>
            </div>
          </>
        )}

        {/* Step: Password Setup */}
        {step === 'password' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#c9a961]/20 dark:bg-[#c9a961]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#c9a961] dark:text-[#d4b87a]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                {t.firstLaunch.setPassword}
              </h1>
              <p className="text-[#696557] dark:text-[#b8b3ac]">
                {t.firstLaunch.setPasswordDesc}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1">
                  {t.firstLaunch.setPassword}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={handlePasswordInputChange}
                  className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0]"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1">
                  {t.firstLaunch.confirmPassword}
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={handleConfirmPasswordInputChange}
                  className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0]"
                  placeholder="••••••••"
                />
              </div>

              {securityMode === 'secure_plus' && (
                <div>
                  <label className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1">
                    {t.firstLaunch.sessionTimeout}
                  </label>
                  <p className="text-xs text-[#a39d94] dark:text-[#8b8580] mb-2">
                    {t.firstLaunch.sessionTimeoutDesc}
                  </p>
                  <div className="flex gap-2">
                    {SESSION_TIMEOUT_OPTIONS.map((option) => (
                      <TimeoutButton
                        key={option.value}
                        value={option.value}
                        label={option.label}
                        isSelected={sessionTimeout === option.value}
                        onSelect={setSessionTimeout}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 border border-[#9d6b6b]/30 dark:border-[#9d6b6b]/40 rounded-lg">
                <p className="text-sm text-[#9d6b6b] dark:text-[#b88585]">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleGoToSecurity}
                disabled={isSubmitting}
                className="flex-1 py-3 px-4 border border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] font-medium rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors disabled:opacity-50"
              >
                {t.common.back}
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={isSubmitting || !password || !confirmPassword}
                className="flex-1 py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {isSubmitting ? t.common.loading : t.common.continue}
              </button>
            </div>
          </>
        )}

        {/* Step: Recovery Phrase */}
        {step === 'recovery' && recoveryPhrase && (
          <RecoveryPhraseDisplay
            phrase={recoveryPhrase}
            onConfirm={handleRecoveryConfirm}
            onBack={handleGoToPassword}
          />
        )}

        {/* Step: Complete */}
        {step === 'complete' && (
          <>
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#7a9b6f]/20 dark:bg-[#7a9b6f]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-[#7a9b6f] dark:text-[#8faf84]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                {t.firstLaunch.setupComplete}
              </h1>
              <p className="text-[#696557] dark:text-[#b8b3ac]">
                {t.firstLaunch.setupCompleteDesc}
              </p>
            </div>

            <div className="bg-[#f3f1ed] dark:bg-[#2a2620]/50 rounded-lg p-4 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-5 h-5 text-[#a39d94]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
                <span className="text-[#1a1815] dark:text-[#b8b3ac]">
                  {languages.find(l => l.code === selectedLanguage)?.nativeName}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-[#a39d94]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="text-[#1a1815] dark:text-[#b8b3ac]">
                  {securityMode === 'easy' && t.firstLaunch.easyAccess}
                  {securityMode === 'secure' && t.firstLaunch.secureUse}
                  {securityMode === 'secure_plus' && `${t.firstLaunch.securePlus} (${sessionTimeout} min)`}
                </span>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 border border-[#9d6b6b]/30 dark:border-[#9d6b6b]/40 rounded-lg">
                <p className="text-sm text-[#9d6b6b] dark:text-[#b88585]">{error}</p>
              </div>
            )}

            <button
              onClick={handleComplete}
              disabled={isSubmitting}
              className="w-full py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? t.common.loading : t.firstLaunch.getStarted}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default FirstLaunch
