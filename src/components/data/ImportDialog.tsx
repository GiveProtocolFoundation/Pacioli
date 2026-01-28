/**
 * Import Dialog
 * Dialog for importing data from an exported JSON file
 */

import React, { useState, useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { storage, type ImportPreview, type ImportResult } from '../../services/storage'

interface ImportDialogProps {
  isOpen: boolean
  onClose: () => void
  onImportComplete?: (result: ImportResult) => void
}

type Step = 'select' | 'preview' | 'password' | 'importing' | 'complete'

/**
 * Dialog component for importing data from an exported JSON file.
 * Supports encrypted exports and provides preview before import.
 */
export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<Step>('select')
  const [filePath, setFilePath] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const reset = useCallback(() => {
    setStep('select')
    setFilePath(null)
    setPreview(null)
    setPassword('')
    setError(null)
    setResult(null)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleBackdropKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClose()
      }
    },
    [handleClose]
  )

  const handlePasswordChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setPassword(e.target.value)
    },
    []
  )

  const handleSelectFile = useCallback(async () => {
    try {
      setError(null)

      const selected = await open({
        multiple: false,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      })

      if (!selected) {
        return // User cancelled
      }

      const path = selected as string
      setFilePath(path)

      // Get preview
      const previewData = await storage.previewImport(path)
      setPreview(previewData)

      if (previewData.encrypted) {
        setStep('password')
      } else {
        setStep('preview')
      }
    } catch (err) {
      console.error('Failed to load file:', err)
      setError(err instanceof Error ? err.message : 'Failed to load file')
    }
  }, [])

  const handleImport = useCallback(async () => {
    if (!filePath) return

    try {
      setError(null)
      setStep('importing')

      const importResult = await storage.importData(
        filePath,
        preview?.encrypted ? password : undefined
      )

      setResult(importResult)
      setStep('complete')
      onImportComplete?.(importResult)
    } catch (err) {
      console.error('Import failed:', err)
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep(preview?.encrypted ? 'password' : 'preview')
    }
  }, [filePath, preview, password, onImportComplete])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black bg-opacity-25"
          onClick={handleClose}
          onKeyDown={handleBackdropKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Close dialog"
        />

        <div className="relative bg-[#fafaf8] dark:bg-[#1a1815] rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-lg font-semibold text-[#1a1815] dark:text-[#f5f3f0] mb-2">
            Import Data
          </h2>

          {step === 'select' && (
            <>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
                Select a Pacioli export file (.json) to import.
              </p>
              <button
                type="button"
                onClick={handleSelectFile}
                className="w-full py-8 border-2 border-dashed border-[rgba(201,169,97,0.15)] rounded-lg hover:border-[#8b4e52] dark:hover:border-[#a86e72] transition-colors"
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-[#a39d94]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="mt-2 text-sm text-[#696557] dark:text-[#b8b3ac]">
                    Click to select a file
                  </p>
                </div>
              </button>
            </>
          )}

          {step === 'password' && preview && (
            <>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
                This export is encrypted. Enter the password to continue.
              </p>

              <div className="mb-4 p-3 bg-[#f3f1ed] dark:bg-[#2a2620] rounded-md">
                <p className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                  <strong>Export date:</strong>{' '}
                  {new Date(preview.exported_at).toLocaleDateString()}
                </p>
              </div>

              <div className="mb-4">
                <label
                  htmlFor="import-password"
                  className="block text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac]"
                >
                  Password
                </label>
                <input
                  id="import-password"
                  type="password"
                  value={password}
                  onChange={handlePasswordChange}
                  className="mt-1 block w-full px-3 py-2 border border-[rgba(201,169,97,0.15)] rounded-md shadow-sm focus:outline-none focus:ring-[#c9a961] focus:border-[#c9a961] dark:bg-[#2a2620] dark:text-[#f5f3f0] sm:text-sm"
                  placeholder="Enter export password"
                />
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <>
              <p className="text-sm text-[#696557] dark:text-[#b8b3ac] mb-4">
                Review the data to be imported.
              </p>

              <div className="mb-4 p-3 bg-[#f3f1ed] dark:bg-[#2a2620] rounded-md">
                <p className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                  <strong>Export version:</strong> {preview.version}
                </p>
                <p className="text-sm text-[#1a1815] dark:text-[#b8b3ac]">
                  <strong>Export date:</strong>{' '}
                  {new Date(preview.exported_at).toLocaleDateString()}
                </p>
                <p className="text-sm text-[#1a1815] dark:text-[#b8b3ac] mt-2">
                  <strong>Data to import:</strong>
                </p>
                <ul className="mt-1 text-sm text-[#696557] dark:text-[#b8b3ac]">
                  <li>• {preview.profile_count} profile(s)</li>
                  <li>• {preview.wallet_count} wallet(s)</li>
                  <li>• {preview.transaction_count} transaction(s)</li>
                </ul>
              </div>

              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <strong>Note:</strong> Importing will add new data to your
                  existing data. Duplicate entries will be skipped.
                </p>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="py-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#8b4e52] mx-auto" />
              <p className="mt-4 text-sm text-[#696557] dark:text-[#b8b3ac]">
                Importing data...
              </p>
            </div>
          )}

          {step === 'complete' && result && (
            <>
              <div className="py-4 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
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
                <p className="mt-2 text-lg font-medium text-[#1a1815] dark:text-[#f5f3f0]">
                  Import Complete
                </p>
              </div>

              <div className="mb-4 p-3 bg-[#f3f1ed] dark:bg-[#2a2620] rounded-md">
                <ul className="text-sm text-[#696557] dark:text-[#b8b3ac]">
                  <li>• {result.profiles_imported} profile(s) imported</li>
                  <li>• {result.wallets_imported} wallet(s) imported</li>
                  <li>
                    • {result.transactions_imported} transaction(s) imported
                  </li>
                </ul>
              </div>

              {result.warnings.length > 0 && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Warnings:
                  </p>
                  <ul className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {result.warnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && (
            <div className="mt-4 text-sm text-[#9d6b6b] dark:text-[#b88585]">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[#1a1815] dark:text-[#b8b3ac] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] rounded-md"
            >
              {step === 'complete' ? 'Close' : 'Cancel'}
            </button>

            {(step === 'preview' || step === 'password') && (
              <button
                type="button"
                onClick={handleImport}
                disabled={step === 'password' && !password}
                className="px-4 py-2 text-sm font-medium text-white bg-[#8b4e52] hover:bg-[#7a4248] rounded-md disabled:opacity-50"
              >
                Import
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
