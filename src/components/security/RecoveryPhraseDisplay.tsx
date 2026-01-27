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

  const words = phrase.split(' ')

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
        <h2 className="text-2xl font-bold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
          {t.recovery.title}
        </h2>
        <p className="text-[#696557] dark:text-[#b8b3ac]">
          {t.recovery.subtitle}
        </p>
      </div>

      {/* Warning */}
      <div className="p-4 bg-[#b89968]/10 dark:bg-[#b89968]/20 border border-[#b89968]/30 dark:border-[#b89968]/40 rounded-lg">
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
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h3 className="font-medium text-[#b89968] dark:text-[#d4b87a]">
              {t.recovery.warning}
            </h3>
            <p className="text-sm text-[#b89968] dark:text-[#c9a961] mt-1">
              {t.recovery.warningDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Recovery Phrase Grid */}
      <div className="bg-[#f3f1ed] dark:bg-[#2a2620]/50 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-2">
          {words.map((word, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-2 bg-[#fafaf8] dark:bg-[#1a1815] rounded border border-[rgba(201,169,97,0.15)]"
            >
              <span className="text-xs text-[#a39d94] dark:text-[#696557] w-5">
                {index + 1}.
              </span>
              <span className="font-mono text-sm text-[#1a1815] dark:text-[#f5f3f0]">
                {word}
              </span>
            </div>
          ))}
        </div>

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopy}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] bg-[#fafaf8] dark:bg-[#1a1815] border border-[rgba(201,169,97,0.15)] rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
        >
          {copied ? (
            <>
              <svg
                className="w-4 h-4 text-[#7a9b6f]"
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
          onChange={e => setConfirmed(e.target.checked)}
          className="mt-1 w-4 h-4 text-[#8b4e52] border-[rgba(201,169,97,0.3)] rounded focus:ring-[#c9a961]"
        />
        <span className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
          {t.recovery.confirmCheckbox}
        </span>
      </label>

      {/* Actions */}
      <div className="flex gap-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex-1 py-3 px-4 border border-[rgba(201,169,97,0.15)] text-[#1a1815] dark:text-[#b8b3ac] font-medium rounded-lg hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
          >
            {t.common.back}
          </button>
        )}
        <button
          type="button"
          onClick={onConfirm}
          disabled={!confirmed}
          className="flex-1 py-3 px-4 bg-[#8b4e52] hover:bg-[#7a4248] text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t.common.continue}
        </button>
      </div>
    </div>
  )
}

export default RecoveryPhraseDisplay
