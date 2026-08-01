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
    /**
     * Handles clicks outside the dropdown element to close it.
     * @param event - The mouse event triggered by clicking outside the dropdown.
     */
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
            ? 'bg-[#294050]/50 text-white/50 cursor-not-allowed'
            : 'bg-[#294050] text-white hover:bg-[#1E2F3C]'
        }`}
      >
        <Download className="w-5 h-5" />
        <span className="hidden sm:inline">Export</span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#F7FAFA] dark:bg-[#11202B] shadow-lg z-50">
          <div className="py-1">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4 text-[#5FE3C0]" />
              Export as CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] transition-colors"
            >
              <FileText className="w-4 h-4 text-[#294050]" />
              Export as PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportDropdown
