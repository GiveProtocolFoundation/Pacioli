/**
 * Unlock Screen
 * Displayed when the app is locked with password protection
 * Includes forgot password flow with recovery phrase
 */

import React, { useState, useCallback } from 'react'
import { useApp } from '../../contexts/AppContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { storage } from '../../services/storage'

type View = 'unlock' | 'reset'

interface UnlockScreenProps {
  onUnlock?: () => void
}

export const UnlockScreen: React.FC<UnlockScreenProps> = ({ onUnlock }) => {
  const { unlock, isUnlocking, error, sessionExpired } = useApp()
  const { t } = useLanguage()
  const [view, setView] = useState<View>('unlock')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  // Reset password state
  const [recoveryPhrase, setRecoveryPhrase] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

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
        const isValid = await storage.verifyRecoveryPhrase(recoveryPhrase.trim())
        if (!isValid) {
          setLocalError(t.recovery.invalidPhrase)
          setIsResetting(false)
          return
        }

        // Reset password
        await storage.resetPasswordWithRecovery(recoveryPhrase.trim(), newPassword)
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fafaf8] to-[#ede8e0] dark:from-[#0f0e0c] dark:to-[#1a1815] px-4">
        <div className="max-w-md w-full">
          <div className="bg-[#fafaf8] dark:bg-[#1a1815] rounded-2xl shadow-xl p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-[#7a9b6f]/20 dark:bg-[#7a9b6f]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-[#7a9b6f] dark:text-[#8faf84]"
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
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
                {t.recovery.resetSuccess}
              </h1>
              <p className="text-[#696557] dark:text-[#b8b3ac]">
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fafaf8] to-[#ede8e0] dark:from-[#0f0e0c] dark:to-[#1a1815] px-4">
        <div className="max-w-md w-full">
          <div className="bg-[#fafaf8] dark:bg-[#1a1815] rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-[#c9a961]/20 dark:bg-[#c9a961]/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-[#c9a961] dark:text-[#d4b87a]"
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
              <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0]">
                {t.recovery.resetTitle}
              </h1>
              <p className="mt-2 text-sm text-[#696557] dark:text-[#b8b3ac]">
                {t.recovery.resetSubtitle}
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* Recovery phrase input */}
              <div>
                <label
                  htmlFor="recoveryPhrase"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1"
                >
                  {t.recovery.enterPhrase}
                </label>
                <textarea
                  id="recoveryPhrase"
                  value={recoveryPhrase}
                  onChange={e => setRecoveryPhrase(e.target.value)}
                  disabled={isResetting}
                  rows={3}
                  className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] font-mono text-sm"
                  placeholder={t.recovery.phrasePlaceholder}
                />
              </div>

              {/* New password */}
              <div>
                <label
                  htmlFor="newPassword"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1"
                >
                  {t.recovery.newPassword}
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={isResetting}
                  className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0]"
                  placeholder="••••••••"
                />
              </div>

              {/* Confirm new password */}
              <div>
                <label
                  htmlFor="confirmNewPassword"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1"
                >
                  {t.recovery.confirmNewPassword}
                </label>
                <input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  disabled={isResetting}
                  className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0]"
                  placeholder="••••••••"
                />
              </div>

              {localError && (
                <div className="p-3 bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 border border-[#9d6b6b]/30 dark:border-[#9d6b6b]/40 rounded-lg">
                  <p className="text-sm text-[#9d6b6b] dark:text-[#b88585]">
                    {localError}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isResetting}
                className="w-full py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? t.common.loading : t.recovery.resetButton}
              </button>

              <button
                type="button"
                onClick={handleBackToUnlock}
                disabled={isResetting}
                className="w-full py-3 px-4 border border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] font-medium rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors disabled:opacity-50"
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#fafaf8] to-[#ede8e0] dark:from-[#0f0e0c] dark:to-[#1a1815] px-4">
      <div className="max-w-md w-full">
        <div className="bg-[#fafaf8] dark:bg-[#1a1815] rounded-2xl shadow-xl p-8">
          {/* Session expired banner */}
          {sessionExpired && (
            <div className="mb-6 p-4 bg-[#b89968]/10 dark:bg-[#b89968]/20 border border-[#b89968]/30 dark:border-[#b89968]/40 rounded-lg">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-[#b89968] flex-shrink-0 mt-0.5"
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
                  <h3 className="font-medium text-[#b89968] dark:text-[#d4b87a]">
                    {t.unlock.sessionExpired}
                  </h3>
                  <p className="text-sm text-[#b89968] dark:text-[#c9a961] mt-1">
                    {t.unlock.sessionExpiredDesc}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-[#8b4e52]/20 dark:bg-[#8b4e52]/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-[#8b4e52] dark:text-[#a86e72]"
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
            <h1 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0]">
              {t.unlock.title}
            </h1>
            <p className="mt-2 text-sm text-[#696557] dark:text-[#b8b3ac]">
              {t.unlock.subtitle}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] mb-1"
              >
                {t.unlock.enterPassword}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                disabled={isUnlocking}
                className="w-full px-4 py-3 border border-[rgba(201,169,97,0.15)] rounded-lg focus:ring-2 focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0]"
                placeholder="••••••••"
              />
            </div>

            {displayError && (
              <div className="p-3 bg-[#9d6b6b]/10 dark:bg-[#9d6b6b]/20 border border-[#9d6b6b]/30 dark:border-[#9d6b6b]/40 rounded-lg">
                <p className="text-sm text-[#9d6b6b] dark:text-[#b88585]">
                  {displayError}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isUnlocking}
              className="w-full py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUnlocking ? t.common.loading : t.unlock.unlock}
            </button>

            {/* Forgot password link */}
            <div className="text-center">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-sm text-[#8b4e52] dark:text-[#a86e72] hover:underline"
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
