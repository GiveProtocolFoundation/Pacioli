/**
 * Recovery Phrase Display Component
 * Displays the 12-word recovery phrase with copy functionality
 */

import React, { useState, useCallback } from 'react'
import { useLanguage } from '../../contexts/LanguageContext'

interface RecoveryPhraseDisplayProps {
  phrase: string
  onConfirm: () => void
  onBack?: () => void
}

export const RecoveryPhraseDisplay: React.FC<RecoveryPhraseDisplayProps> = ({
  phrase,
  onConfirm,
  onBack,
}) => {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const numberedWords = phrase.split(' ').map((word, i) => ({
    word,
    position: i + 1,
  }))

  const handleConfirmedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setConfirmed(e.target.checked)
    },
    []
  )

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(phrase)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }, [phrase])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
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
        <h2 className="text-2xl font-bold text-[#11202B] dark:text-[#EAF3F2] mb-2">
          {t.recovery.title}
        </h2>
        <p className="text-[#294050] dark:text-[#9FB4BE]">
          {t.recovery.subtitle}
        </p>
      </div>

      {/* Warning */}
      <div className="p-4 bg-[#E8B36F]/10 dark:bg-[#E8B36F]/20 border border-[#E8B36F]/30 dark:border-[#E8B36F]/40 rounded-lg">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-[#E8B36F] dark:text-[#9CF1DC]">
              {t.recovery.warning}
            </h3>
            <p className="text-sm text-[#E8B36F] dark:text-[#5FE3C0] mt-1">
              {t.recovery.warningDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Phrase Grid */}
      <div className="bg-[#EAF3F2] dark:bg-[#16242F]/50 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-2">
          {numberedWords.map(({ word, position }) => (
            <div
              key={`word-${position}`}
              className="flex items-center gap-2 p-2 bg-[#F7FAFA] dark:bg-[#11202B] rounded border border-[rgba(95,227,192,0.15)]"
            >
              <span className="text-xs text-[#647D8B] dark:text-[#294050] w-5">
                {position}.
              </span>
              <span className="font-mono text-sm text-[#11202B] dark:text-[#EAF3F2]">
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-[#11202B] dark:text-[#9FB4BE] bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4 text-[#2E9A82]"
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
              {t.recovery.copied}
            </>
          ) : (
            <>
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              {t.recovery.copyButton}
            </>
          )}
        </button>
      </div>

      {/* Confirmation Checkbox */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={handleConfirmedChange}
          className="mt-1 w-4 h-4 text-[#294050] border-[rgba(95,227,192,0.3)] rounded focus:ring-[#5FE3C0]"
        />
        <span className="text-sm text-[#11202B] dark:text-[#9FB4BE]">
          {t.recovery.confirmCheckbox}
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-[rgba(95,227,192,0.15)] text-[#11202B] dark:text-[#9FB4BE] font-medium rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
          >
            {t.common.back}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!confirmed}
          className="flex-1 py-3 px-4 bg-[#294050] hover:bg-[#1E2F3C] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.common.continue}
        </button>
      </div>
    </div>
  )
}

export default RecoveryPhraseDisplay
