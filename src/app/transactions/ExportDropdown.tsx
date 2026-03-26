import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'
import type { Transaction } from '../../types/transaction'
import {
  exportTransactionsCSV,
  exportTransactionsPDF,
} from '../../utils/exportTransactions'

interface ExportDropdownProps {
  transactions: Transaction[]
}

/** Dropdown menu for exporting transactions as CSV or PDF */
const ExportDropdown: React.FC<ExportDropdownProps> = ({ transactions }) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const disabled = transactions.length === 0

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = useCallback(() => {
    if (!disabled) setIsOpen(prev => !prev)
  }, [disabled])

  const handleExportCSV = useCallback(() => {
    exportTransactionsCSV(transactions)
    setIsOpen(false)
  }, [transactions])

  const handleExportPDF = useCallback(() => {
    exportTransactionsPDF(transactions)
    setIsOpen(false)
  }, [transactions])

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
          disabled
            ? 'bg-[#8b4e52]/50 text-white/50 cursor-not-allowed'
            : 'bg-[#8b4e52] text-white hover:bg-[#7a4248]'
        }`}
      >
        <Download className="w-5 h-5" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[rgba(201,169,97,0.15)] bg-[#fafaf8] dark:bg-[#1a1815] shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#1a1815] dark:text-[#f5f3f0] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#7a9b6f]" />
              Export as CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#1a1815] dark:text-[#f5f3f0] hover:bg-[#f3f1ed] dark:hover:bg-[#2a2620] transition-colors"
            >
              <FileText className="w-4 h-4 text-[#8b4e52]" />
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportDropdown
