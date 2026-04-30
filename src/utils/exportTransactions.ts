import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transaction } from '../types/transaction'

/** Downloads a Blob as a file via a temporary anchor element */
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Formats a transaction date as a locale string */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString()
}

/** RFC 4180 CSV field escaping — wraps in quotes if the value contains comma, quote, or newline */
function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const CSV_HEADERS = [
  'Date',
  'Type',
  'Description',
  'Category',
  'Wallet',
  'Amount',
  'Token',
  'Fiat Value',
  'Currency',
  'Status',
  'Hash',
  'Memo',
]

/** Converts a Transaction to an array of string cell values for export */
function transactionToRow(tx: Transaction): string[] {
  return [
    formatDate(tx.date),
    tx.type,
    tx.description,
    tx.category,
    tx.wallet,
    String(tx.amount),
    tx.crypto || tx.tokenId || '',
    String(tx.fiatValue),
    tx.fiatCurrency || '',
    tx.status,
    tx.hash || '',
    tx.memo || '',
  ]
}

/** Exports transactions as an RFC 4180 CSV file download */
export function exportTransactionsCSV(transactions: Transaction[]) {
  const rows = transactions.map(transactionToRow)
  const csvContent = [
    CSV_HEADERS.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(',')),
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  downloadBlob(blob, `transactions-${new Date().toISOString().split('T')[0]}.csv`)
}

/** Exports transactions as a styled PDF report in landscape A4 */
export function exportTransactionsPDF(transactions: Transaction[]) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const now = new Date()

  // Title
  doc.setFontSize(18)
  doc.setTextColor(139, 78, 82) // #8b4e52 burgundy
  doc.text('Transaction Report', 14, 20)

  // Subtitle with date
  doc.setFontSize(10)
  doc.setTextColor(105, 101, 87) // #696557
  doc.text(`Generated: ${now.toLocaleString()}`, 14, 27)
  doc.text(`Total transactions: ${transactions.length}`, pageWidth - 14, 27, {
    align: 'right',
  })

  // Table
  const rows = transactions.map(transactionToRow)

  autoTable(doc, {
    startY: 32,
    head: [CSV_HEADERS],
    body: rows,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [26, 24, 21], // #1a1815
      lineColor: [201, 169, 97], // #c9a961
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [139, 78, 82], // #8b4e52 burgundy
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [243, 241, 237], // #f3f1ed parchment
    },
    bodyStyles: {
      fillColor: [250, 250, 248], // #fafaf8
    },
    margin: { top: 32, left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.setTextColor(105, 101, 87)
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      )
    },
  })

  doc.save(`transactions-${now.toISOString().split('T')[0]}.pdf`)
}
