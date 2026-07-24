/**
 * Unlock Screen
 * Displayed when the app is locked with password protection
 * Includes forgot password flow with recovery phrase
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'
import { useApp } from '../../contexts/AppContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { storage } from '../../services/storage'

type View = 'unlock' | 'reset'

interface UnlockScreenProps {
  onUnlock?: () => void
}

/**
 * UnlockScreen component handles the unlocking of the app via password and provides a password reset flow.
 *
 * @param onUnlock Callback invoked when the unlock operation is successful.
 * @returns JSX.Element
 */
export const UnlockScreen: React.FC<UnlockScreenProps> = ({ onUnlock }) => {
  const { unlock, isUnlocking, error, sessionExpired } = useApp()
  const { t } = useLanguage()
  const [view, setView] = useState<View>('unlock')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  // Focus password field when unlock view is shown
  useEffect(() => {
    if (view === 'unlock') {
      passwordRef.current?.focus()
    }
  }, [view])

  // Reset password state
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  /**
   * handlePasswordChange updates the password state when the user types in the password field.
   *
   * @param e The change event from the password input element.
   * @returns void
   */
  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    []
  )
    []
  )

  const handleRecoveryPhraseChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRecoveryPhrase(e.target.value)
    },
    []
  )

  const handleNewPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setNewPassword(e.target.value)
    },
    []
  )

  const handleConfirmNewPasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmNewPassword(e.target.value)
    },
    []
  )

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLocalError(null)

      if (!password) {
        setLocalError(t.unlock.enterPassword)
        return
      }

      const success = await unlock(password)
      if (success) {
        setPassword('')
        onUnlock?.()
      }
    },
    [password, unlock, onUnlock, t]
  )

  const handleForgotPassword = useCallback(() => {
    setView('reset')
    setLocalError(null)
    setRecoveryPhrase('')
    setNewPassword('')
    setConfirmNewPassword('')
    setResetSuccess(false)
  }, [])

  const handleBackToUnlock = useCallback(() => {
    setView('unlock')
    setLocalError(null)
    setRecoveryPhrase('')
    setNewPassword('')
    setConfirmNewPassword('')
    setResetSuccess(false)
  }, [])

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      setLocalError(null)

      // Validate recovery phrase
      if (!recoveryPhrase.trim()) {
        setLocalError(t.recovery.enterPhrase)
        return
      }

      // Validate new password
      if (newPassword.length < 8) {
        setLocalError(t.firstLaunch.passwordTooShort)
        return
      }

      if (newPassword !== confirmNewPassword) {
        setLocalError(t.firstLaunch.passwordMismatch)
        return
      }

      setIsResetting(true)

      try {
        // Verify recovery phrase first
        const isValid = await storage.verifyRecoveryPhrase(
          recoveryPhrase.trim()
        )
        if (!isValid) {
          setLocalError(t.recovery.invalidPhrase)
          setIsResetting(false)
          return
        }

        // Reset password
        await storage.resetPasswordWithRecovery(
          recoveryPhrase.trim(),
          newPassword
        )
        setResetSuccess(true)

        // Auto-unlock after successful reset
        setTimeout(async () => {
          const success = await unlock(newPassword)
          if (success) {
            onUnlock?.()
          }
        }, 1500)
      } catch {
        setLocalError(t.recovery.invalidPhrase)
      } finally {
        setIsResetting(false)
      }
    },
    [recoveryPhrase, newPassword, confirmNewPassword, unlock, onUnlock, t]
  )

  const displayError = localError || (error ? t.unlock.incorrectPassword : null)

  // Reset password success view
  if (resetSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7FAFA] to-[#D9E5E4] dark:from-[#0C141B] dark:to-[#11202B] px-4">
        <div className="max-w-md w-full">
          <div className="bg-[#F7FAFA] dark:bg-[#11202B] rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#2E9A82]/20 dark:bg-[#2E9A82]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-[#2E9A82] dark:text-[#8faf84]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2] mb-2">
                {t.recovery.resetSuccess}
              </h1>
              <p className="text-[#294050] dark:text-[#9FB4BE]">
                {t.common.loading}
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Reset password form
  if (view === 'reset') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7FAFA] to-[#D9E5E4] dark:from-[#0C141B] dark:to-[#11202B] px-4">
        <div className="max-w-md w-full">
          <div className="bg-[#F7FAFA] dark:bg-[#11202B] rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#5FE3C0]/20 dark:bg-[#5FE3C0]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-[#5FE3C0] dark:text-[#9CF1DC]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z"
                  />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
                {t.recovery.resetTitle}
              </h1>
              <p className="mt-2 text-sm text-[#294050] dark:text-[#9FB4BE]">
                {t.recovery.resetSubtitle}
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* Recovery phrase input */}
              <div>
                <label
                  htmlFor="recoveryPhrase"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-1"
                >
                  {t.recovery.enterPhrase}
                </label>
                <textarea
                  id="recoveryPhrase"
                  value={recoveryPhrase}
                  onChange={handleRecoveryPhraseChange}
                  disabled={isResetting}
                  rows={3}
                  className="w-full px-4 py-3 border border-[rgba(95,227,192,0.15)] rounded-lg focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2] font-mono text-sm"
                  placeholder={t.recovery.phrasePlaceholder}
                />
              </div>

              {/* New password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-1"
                >
                  {t.recovery.newPassword}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={handleNewPasswordChange}
                  disabled={isResetting}
                  className="w-full px-4 py-3 border border-[rgba(95,227,192,0.15)] rounded-lg focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2]"
                  placeholder="••••••••"
                />
              </div>

              {/* Confirm new password */}
              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-1"
                >
                  {t.recovery.confirmNewPassword}
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={handleConfirmNewPasswordChange}
                  disabled={isResetting}
                  className="w-full px-4 py-3 border border-[rgba(95,227,192,0.15)] rounded-lg focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2]"
                  placeholder="••••••••"
                />
              </div>

              {localError && (
                <div className="p-3 bg-[#E8836F]/10 dark:bg-[#E8836F]/20 border border-[#E8836F]/30 dark:border-[#E8836F]/40 rounded-lg">
                  <p className="text-sm text-[#E8836F] dark:text-[#F09988]">
                    {localError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-3 px-4 bg-[#294050] hover:bg-[#1E2F3C] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? t.common.loading : t.recovery.resetButton}
              </button>

              <button
                type="button"
                onClick={handleBackToUnlock}
                disabled={isResetting}
                className="w-full py-3 px-4 border border-[rgba(95,227,192,0.15)] text-[#11202B] dark:text-[#9FB4BE] font-medium rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors disabled:opacity-50"
              >
                {t.recovery.backToLogin}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  // Unlock form (default view)
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#F7FAFA] to-[#D9E5E4] dark:from-[#0C141B] dark:to-[#11202B] px-4">
      <div className="max-w-md w-full">
        <div className="bg-[#F7FAFA] dark:bg-[#11202B] rounded-2xl shadow-xl p-8">
          {/* Session expired banner */}
          {sessionExpired && (
            <div className="mb-6 p-4 bg-[#E8B36F]/10 dark:bg-[#E8B36F]/20 border border-[#E8B36F]/30 dark:border-[#E8B36F]/40 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[#E8B36F] flex-shrink-0 mt-0.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h3 className="font-medium text-[#E8B36F] dark:text-[#9CF1DC]">
                    {t.unlock.sessionExpired}
                  </h3>
                  <p className="text-sm text-[#E8B36F] dark:text-[#5FE3C0] mt-1">
                    {t.unlock.sessionExpiredDesc}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#294050]/20 dark:bg-[#294050]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[#294050] dark:text-[#F09988]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2]">
              {t.unlock.title}
            </h1>
            <p className="mt-2 text-sm text-[#294050] dark:text-[#9FB4BE]">
              {t.unlock.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] mb-1"
              >
                {t.unlock.enterPassword}
              </label>
              <input
                ref={passwordRef}
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                disabled={isUnlocking}
                className="w-full px-4 py-3 border border-[rgba(95,227,192,0.15)] rounded-lg focus:ring-2 focus:ring-[#5FE3C0] focus:border-[#5FE3C0] dark:bg-[#16242F] dark:text-[#EAF3F2]"
                placeholder="••••••••"
              />
            </div>

            {displayError && (
              <div className="p-3 bg-[#E8836F]/10 dark:bg-[#E8836F]/20 border border-[#E8836F]/30 dark:border-[#E8836F]/40 rounded-lg">
                <p className="text-sm text-[#E8836F] dark:text-[#F09988]">
                  {displayError}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUnlocking}
              className="w-full py-3 px-4 bg-[#294050] hover:bg-[#1E2F3C] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUnlocking ? t.common.loading : t.unlock.unlock}
            </button>

            {/* Forgot password link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-[#294050] dark:text-[#F09988] hover:underline"
              >
                {t.unlock.forgotPassword}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
