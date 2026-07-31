/* eslint-disable react-refresh/only-export-components */
/**
 * Cost Basis Report
 * Surfaces FIFO/LIFO/HIFO/SpecID calculations from costBasisService
 * using real transaction data from the persistence layer.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ArrowLeft,
  Calculator,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../contexts/ProfileContext'
import { persistence } from '../../services/persistence'
import type { StoredTransaction } from '../../services/persistence'
import {
  calculateCostBasis,
  calculateAllMethods,
  calculateGainLoss,
  calculateHoldingPeriod,
  calculateWeightedAverage,
  validateLots,
} from '../../services/costBasisService'
import type { DisposalResult } from '../../services/costBasisService'
import type { CryptoLot, CostBasisMethod } from '../../types/cryptoAccounting'

// ─── Types ───────────────────────────────────────────────────────────────────

interface DisposalRecord {
  id: string
  assetSymbol: string
  quantity: string
  date: string
  proceeds: string
  result: DisposalResult
  gainLoss: { gainLoss: string; isGain: boolean }
  holdingPeriod: { days: number; isLongTerm: boolean }
}

interface ReportData {
  lots: CryptoLot[]
  disposals: DisposalRecord[]
  totalRealizedGain: string
  totalShortTermGain: string
  totalLongTermGain: string
  remainingLots: CryptoLot[]
  allMethodsComparison: Record<
    string,
    { FIFO: string; LIFO: string; HIFO: string }
  >
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Filter stored transactions for balance and cost-basis accounting.
 *
 * Removes matched XCM receive legs to avoid double-counting cross-chain
 * transfers. The paired send already represents the full economic event.
 * Unmatched XCM receives (xcm_status='pending' or unannotated) are kept so
 * they surface as pending items for review.
 */
export function filterStoredTransactionsForAccounting(
  txs: StoredTransaction[]
): StoredTransaction[] {
  return txs.filter(
    tx =>
      tx.tx_type !== 'xcm' ||
      tx.xcm_role === 'send' ||
      // Unmatched receive: keep as pending
      (tx.xcm_role === 'receive' && tx.xcm_status !== 'matched') ||
      // No role annotation yet: keep conservatively (pre-GIV-447 data)
      !tx.xcm_role
    // Matched receive: excluded — already captured by the send leg
  )
}

/**
 * Build CryptoLot objects from raw stored transactions.
 * Incoming transactions (receive/deposit) become acquisition lots.
 */
export function buildLotsFromTransactions(
  transactions: StoredTransaction[],
  assetFilter?: string
): CryptoLot[] {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.timestamp ?? a.created_at).getTime() -
      new Date(b.timestamp ?? b.created_at).getTime()
  )

  const lots: CryptoLot[] = []

  for (const tx of sorted) {
    const symbol = tx.token_symbol ?? tx.chain
    if (assetFilter && symbol !== assetFilter) continue
    if (!tx.value || parseFloat(tx.value) <= 0) continue

    // Incoming transactions: receive, deposit, transfer_in, reward, mint
    const incomingTypes = [
      'receive',
      'deposit',
      'transfer_in',
      'reward',
      'mint',
      'buy',
    ]
    const isIncoming =
      tx.tx_type && incomingTypes.includes(tx.tx_type.toLowerCase())

    if (!isIncoming) continue

    const quantity = tx.value
    const acquisitionDate = tx.timestamp ?? tx.created_at
    // Use price_at_acquisition_usd (USD per unit) when available for accurate cost basis.
    // Fall back to fee/quantity proxy for legacy data that pre-dates this field.
    const costPerUnit = tx.price_at_acquisition_usd
      ? tx.price_at_acquisition_usd
      : tx.fee
        ? (parseFloat(tx.fee) / parseFloat(quantity)).toString()
        : '0'
    const acquisitionCost = tx.price_at_acquisition_usd
      ? (
          parseFloat(tx.price_at_acquisition_usd) * parseFloat(quantity)
        ).toString()
      : (tx.fee ?? '0')

    lots.push({
      lotId: tx.id,
      acquisitionDate,
      quantity,
      remainingQuantity: quantity,
      acquisitionCost,
      costPerUnit,
      fairValueAtAcquisition: costPerUnit,
      currentFairValue: costPerUnit,
      lastFairValueUpdate: acquisitionDate,
      classification: 'Investment',
      activeMarket: { hasActiveMarket: true, lastUpdated: acquisitionDate },
      impairmentHistory: [],
      cumulativeImpairment: '0',
      transactionHash: tx.hash,
      walletAddress: tx.to_address ?? undefined,
    })
  }

  return lots
}

/**
 * Extract disposal events from transactions (outgoing sends/sales).
 */
export function buildDisposalsFromTransactions(
  transactions: StoredTransaction[],
  assetFilter?: string
): Array<{
  id: string
  assetSymbol: string
  quantity: string
  date: string
  proceeds: string
}> {
  const sorted = [...transactions].sort(
    (a, b) =>
      new Date(a.timestamp ?? a.created_at).getTime() -
      new Date(b.timestamp ?? b.created_at).getTime()
  )

  const disposals: Array<{
    id: string
    assetSymbol: string
    quantity: string
    date: string
    proceeds: string
  }> = []

  for (const tx of sorted) {
    const symbol = tx.token_symbol ?? tx.chain
    if (assetFilter && symbol !== assetFilter) continue
    if (!tx.value || parseFloat(tx.value) <= 0) continue

    const outgoingTypes = ['send', 'withdrawal', 'transfer_out', 'sell', 'swap']
    const isOutgoing =
      tx.tx_type && outgoingTypes.includes(tx.tx_type.toLowerCase())

    if (!isOutgoing) continue

    disposals.push({
      id: tx.id,
      assetSymbol: symbol,
      quantity: tx.value,
      date: tx.timestamp ?? tx.created_at,
      proceeds: tx.fee ?? '0',
    })
  }

  return disposals
}

/**
 * Run cost basis calculations for all disposals using the selected method.
 */
export function computeReport(
  lots: CryptoLot[],
  rawDisposals: Array<{
    id: string
    assetSymbol: string
    quantity: string
    date: string
    proceeds: string
  }>,
  method: CostBasisMethod,
  dateStart?: string,
  dateEnd?: string
): ReportData {
  const currentLots = [...lots]
  const disposals: DisposalRecord[] = []
  let totalRealized = 0
  let totalShortTerm = 0
  let totalLongTerm = 0
  const allMethodsMap: Record<
    string,
    { FIFO: string; LIFO: string; HIFO: string }
  > = {}

  for (const raw of rawDisposals) {
    // Date filter
    if (dateStart && raw.date < dateStart) continue
    if (dateEnd && raw.date > dateEnd) continue

    try {
      const result = calculateCostBasis(
        {
          assetSymbol: raw.assetSymbol,
          quantity: raw.quantity,
          disposalDate: raw.date,
          method,
        },
        currentLots
      )

      const gl = calculateGainLoss(result.totalCostBasis, raw.proceeds)
      const hp = calculateHoldingPeriod(
        result.lotsUsed[0]?.lotId
          ? (currentLots.find(l => l.lotId === result.lotsUsed[0].lotId)
              ?.acquisitionDate ?? raw.date)
          : raw.date,
        raw.date
      )

      const gainVal = parseFloat(gl.gainLoss)
      totalRealized += gainVal
      if (hp.isLongTerm) {
        totalLongTerm += gainVal
      } else {
        totalShortTerm += gainVal
      }

      disposals.push({
        id: raw.id,
        assetSymbol: raw.assetSymbol,
        quantity: raw.quantity,
        date: raw.date,
        proceeds: raw.proceeds,
        result,
        gainLoss: gl,
        holdingPeriod: hp,
      })

      // Update lots for next disposal
      for (const used of result.lotsUsed) {
        const idx = currentLots.findIndex(l => l.lotId === used.lotId)
        if (idx !== -1) {
          const remaining =
            parseFloat(currentLots[idx].remainingQuantity) -
            parseFloat(used.quantityUsed)
          currentLots[idx] = {
            ...currentLots[idx],
            remainingQuantity: Math.max(0, remaining).toString(),
          }
        }
      }

      // All methods comparison
      try {
        allMethodsMap[raw.id] = calculateAllMethods(
          lots,
          raw.quantity,
          raw.date
        )
      } catch {
        // Skip comparison if insufficient lots
      }
    } catch {
      // Skip disposals that can't be allocated (insufficient lots)
    }
  }

  return {
    lots,
    disposals,
    totalRealizedGain: totalRealized.toFixed(6),
    totalShortTermGain: totalShortTerm.toFixed(6),
    totalLongTermGain: totalLongTerm.toFixed(6),
    remainingLots: currentLots.filter(l => parseFloat(l.remainingQuantity) > 0),
    allMethodsComparison: allMethodsMap,
  }
}

function formatNumber(value: string | number, decimals = 6): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) return dateString
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getUniqueAssets(transactions: StoredTransaction[]): string[] {
  const set = new Set<string>()
  for (const tx of transactions) {
    const symbol = tx.token_symbol ?? tx.chain
    if (symbol) set.add(symbol)
  }
  return Array.from(set).sort()
}

function getCurrentTaxYear(): number {
  return new Date().getFullYear()
}

function getTaxYearRange(year: number): { start: string; end: string } {
  return {
    start: `${year}-01-01T00:00:00Z`,
    end: `${year}-12-31T23:59:59Z`,
  }
}

// ─── Export Helpers ──────────────────────────────────────────────────────────

export function exportReportCSV(
  data: ReportData,
  method: CostBasisMethod
): string {
  const lines: string[] = []
  lines.push(
    'Date,Asset,Quantity,Proceeds,Cost Basis,Gain/Loss,Holding Period,Term'
  )
  for (const d of data.disposals) {
    lines.push(
      [
        formatDate(d.date),
        d.assetSymbol,
        d.quantity,
        d.proceeds,
        d.result.totalCostBasis,
        d.gainLoss.gainLoss,
        `${d.holdingPeriod.days} days`,
        d.holdingPeriod.isLongTerm ? 'Long-term' : 'Short-term',
      ].join(',')
    )
  }
  lines.push('')
  lines.push(`Method,${method}`)
  lines.push(`Total Realized Gain/Loss,${data.totalRealizedGain}`)
  lines.push(`Short-term,${data.totalShortTermGain}`)
  lines.push(`Long-term,${data.totalLongTermGain}`)
  lines.push('')
  lines.push('--- Remaining Lots ---')
  lines.push('Lot ID,Acquisition Date,Remaining Qty,Cost Per Unit')
  for (const lot of data.remainingLots) {
    lines.push(
      [
        lot.lotId.substring(0, 8),
        formatDate(lot.acquisitionDate),
        lot.remainingQuantity,
        lot.costPerUnit,
      ].join(',')
    )
  }
  return lines.join('\n')
}

export function exportReportJSON(
  data: ReportData,
  method: CostBasisMethod
): string {
  return JSON.stringify(
    {
      method,
      generatedAt: new Date().toISOString(),
      summary: {
        totalRealizedGain: data.totalRealizedGain,
        shortTermGain: data.totalShortTermGain,
        longTermGain: data.totalLongTermGain,
        disposalCount: data.disposals.length,
        remainingLotCount: data.remainingLots.length,
      },
      disposals: data.disposals.map(d => ({
        date: d.date,
        asset: d.assetSymbol,
        quantity: d.quantity,
        proceeds: d.proceeds,
        costBasis: d.result.totalCostBasis,
        gainLoss: d.gainLoss.gainLoss,
        isGain: d.gainLoss.isGain,
        holdingDays: d.holdingPeriod.days,
        isLongTerm: d.holdingPeriod.isLongTerm,
        lotAllocations: d.result.lotsUsed,
      })),
      remainingLots: data.remainingLots.map(l => ({
        lotId: l.lotId,
        acquisitionDate: l.acquisitionDate,
        remainingQuantity: l.remainingQuantity,
        costPerUnit: l.costPerUnit,
        acquisitionCost: l.acquisitionCost,
      })),
    },
    null,
    2
  )
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ─── Sub-components ─────────────────────────────────────────────────────────

const METHODS: {
  value: CostBasisMethod
  label: string
  description: string
}[] = [
  { value: 'FIFO', label: 'FIFO', description: 'First In, First Out' },
  { value: 'LIFO', label: 'LIFO', description: 'Last In, First Out' },
  { value: 'HIFO', label: 'HIFO', description: 'Highest In, First Out' },
  {
    value: 'SpecificID',
    label: 'Specific ID',
    description: 'Specify lots manually',
  },
]

const MethodSelector: React.FC<{
  selected: CostBasisMethod
  onChange: (method: CostBasisMethod) => void
}> = ({ selected, onChange }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
    {METHODS.map(m => {
      const isDisabled = m.value === 'SpecificID'
      return (
        <button
          key={m.value}
          onClick={() => !isDisabled && onChange(m.value)}
          disabled={isDisabled}
          title={isDisabled ? 'Lot selection UI coming soon' : undefined}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
            isDisabled
              ? 'bg-[#F7FAFA] dark:bg-[#11202B] text-[#647D8B] dark:text-[#294050] border-[rgba(95,227,192,0.1)] cursor-not-allowed opacity-60'
              : selected === m.value
                ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988] border-[#294050]/30 dark:border-[#294050]/40'
                : 'bg-[#F7FAFA] dark:bg-[#11202B] text-[#294050] dark:text-[#9FB4BE] border-[rgba(95,227,192,0.15)] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]'
          }`}
        >
          <div className="font-semibold">{m.label}</div>
          <div className="text-xs opacity-75 mt-0.5">
            {isDisabled ? 'Coming soon' : m.description}
          </div>
        </button>
      )
    })}
  </div>
)

const SummaryCard: React.FC<{
  label: string
  value: string
  isPositive?: boolean
  Icon: React.ElementType
}> = ({ label, value, isPositive, Icon }) => (
  <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">{label}</p>
        <p
          className={`text-xl font-semibold mt-1 font-mono tabular-nums ${
            isPositive === undefined
              ? 'text-[#11202B] dark:text-[#EAF3F2]'
              : isPositive
                ? 'text-[#5FE3C0]'
                : 'text-[#E8836F]'
          }`}
        >
          {value}
        </p>
      </div>
      <div className="stat-icon-container">
        <Icon className="w-5 h-5" />
      </div>
    </div>
  </div>
)

const DisposalTable: React.FC<{
  disposals: DisposalRecord[]
  expandedId: string | null
  onToggle: (id: string) => void
}> = ({ disposals, expandedId, onToggle }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[rgba(95,227,192,0.15)]">
          <th className="text-left py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Date
          </th>
          <th className="text-left py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Asset
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Quantity
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Cost Basis
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Proceeds
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Gain/Loss
          </th>
          <th className="text-center py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Term
          </th>
          <th className="py-3 px-3"></th>
        </tr>
      </thead>
      <tbody>
        {disposals.map(d => (
          <React.Fragment key={d.id}>
            <tr
              className="border-b border-[rgba(95,227,192,0.1)] hover:bg-[rgba(95,227,192,0.03)] dark:hover:bg-[rgba(95,227,192,0.05)] cursor-pointer transition-colors"
              onClick={() => onToggle(d.id)}
            >
              <td className="py-3 px-3 text-[#11202B] dark:text-[#EAF3F2]">
                {formatDate(d.date)}
              </td>
              <td className="py-3 px-3 font-medium text-[#11202B] dark:text-[#EAF3F2]">
                {d.assetSymbol}
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
                {formatNumber(d.quantity)}
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
                {formatNumber(d.result.totalCostBasis)}
              </td>
              <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
                {formatNumber(d.proceeds)}
              </td>
              <td
                className={`py-3 px-3 text-right font-mono tabular-nums font-medium ${
                  d.gainLoss.isGain ? 'text-[#5FE3C0]' : 'text-[#E8836F]'
                }`}
              >
                {d.gainLoss.isGain ? '+' : ''}
                {formatNumber(d.gainLoss.gainLoss)}
              </td>
              <td className="py-3 px-3 text-center">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    d.holdingPeriod.isLongTerm
                      ? 'bg-[#5FE3C0]/10 text-[#5FE3C0]'
                      : 'bg-[#E8B36F]/10 text-[#E8B36F]'
                  }`}
                >
                  {d.holdingPeriod.isLongTerm ? 'Long' : 'Short'}
                </span>
              </td>
              <td className="py-3 px-3 text-center">
                {expandedId === d.id ? (
                  <ChevronUp className="w-4 h-4 text-[#294050]" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-[#294050]" />
                )}
              </td>
            </tr>
            {expandedId === d.id && (
              <tr>
                <td
                  colSpan={8}
                  className="bg-[#EAF3F2]/50 dark:bg-[#11202B]/50 px-6 py-4"
                >
                  <div className="text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-2">
                    Lot Allocations
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[rgba(95,227,192,0.1)]">
                        <th className="text-left py-1.5 px-2 text-[#647D8B]">
                          Lot ID
                        </th>
                        <th className="text-right py-1.5 px-2 text-[#647D8B]">
                          Qty Used
                        </th>
                        <th className="text-right py-1.5 px-2 text-[#647D8B]">
                          Cost Basis
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.result.lotsUsed.map(lu => (
                        <tr
                          key={lu.lotId}
                          className="border-b border-[rgba(95,227,192,0.05)]"
                        >
                          <td className="py-1.5 px-2 font-mono text-[#11202B] dark:text-[#EAF3F2]">
                            {lu.lotId.substring(0, 12)}...
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
                            {formatNumber(lu.quantityUsed)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
                            {formatNumber(lu.costBasis)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-[#647D8B]">
                    Holding period: {d.holdingPeriod.days} days | Avg cost/unit:{' '}
                    {formatNumber(d.result.averageCostPerUnit)}
                  </p>
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
)

const RemainingLotsTable: React.FC<{ lots: CryptoLot[] }> = ({ lots }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[rgba(95,227,192,0.15)]">
          <th className="text-left py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Lot ID
          </th>
          <th className="text-left py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Acquired
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Remaining Qty
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Cost/Unit
          </th>
          <th className="text-right py-3 px-3 text-xs font-semibold text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider">
            Total Cost
          </th>
        </tr>
      </thead>
      <tbody>
        {lots.map(lot => (
          <tr
            key={lot.lotId}
            className="border-b border-[rgba(95,227,192,0.1)] hover:bg-[rgba(95,227,192,0.03)] dark:hover:bg-[rgba(95,227,192,0.05)] transition-colors"
          >
            <td className="py-3 px-3 font-mono text-xs text-[#11202B] dark:text-[#EAF3F2]">
              {lot.lotId.substring(0, 12)}...
            </td>
            <td className="py-3 px-3 text-[#11202B] dark:text-[#EAF3F2]">
              {formatDate(lot.acquisitionDate)}
            </td>
            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
              {formatNumber(lot.remainingQuantity)}
            </td>
            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
              {formatNumber(lot.costPerUnit)}
            </td>
            <td className="py-3 px-3 text-right font-mono tabular-nums text-[#11202B] dark:text-[#EAF3F2]">
              {formatNumber(
                (
                  parseFloat(lot.remainingQuantity) *
                  parseFloat(lot.costPerUnit)
                ).toString()
              )}
            </td>
          </tr>
        ))}
        {lots.length === 0 && (
          <tr>
            <td colSpan={5} className="py-8 text-center text-sm text-[#647D8B]">
              No remaining lots
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)

// ─── Main Component ─────────────────────────────────────────────────────────

const CostBasisReport: React.FC = () => {
  const navigate = useNavigate()
  const { currentProfile } = useProfile()

  // Filters
  const [method, setMethod] = useState<CostBasisMethod>('FIFO')
  const [selectedAsset, setSelectedAsset] = useState<string>('all')
  const [taxYear, setTaxYear] = useState<number>(getCurrentTaxYear())
  const [useDateRange, setUseDateRange] = useState(false)
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')

  // Data
  const [transactions, setTransactions] = useState<StoredTransaction[]>([])
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // UI
  const [expandedDisposal, setExpandedDisposal] = useState<string | null>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [activeTab, setActiveTab] = useState<'disposals' | 'holdings'>(
    'disposals'
  )

  const assets = useMemo(() => getUniqueAssets(transactions), [transactions])

  // Load transactions
  useEffect(() => {
    const load = async () => {
      if (!currentProfile) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)
      try {
        const txs = await persistence.getAllTransactions(currentProfile.id, {
          limit: 10000,
        })
        setTransactions(filterStoredTransactionsForAccounting(txs))
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load transactions'
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currentProfile])

  // Compute report when filters change
  useEffect(() => {
    if (transactions.length === 0) {
      setReportData(null)
      return
    }

    const assetFilter = selectedAsset === 'all' ? undefined : selectedAsset
    const lots = buildLotsFromTransactions(transactions, assetFilter)
    const rawDisposals = buildDisposalsFromTransactions(
      transactions,
      assetFilter
    )

    let start: string | undefined
    let end: string | undefined

    if (useDateRange && dateStart && dateEnd) {
      start = dateStart
      end = dateEnd
    } else {
      const range = getTaxYearRange(taxYear)
      start = range.start
      end = range.end
    }

    const data = computeReport(lots, rawDisposals, method, start, end)
    setReportData(data)
  }, [
    transactions,
    method,
    selectedAsset,
    taxYear,
    useDateRange,
    dateStart,
    dateEnd,
  ])

  const handleExport = useCallback(
    (format: 'csv' | 'json') => {
      if (!reportData) return
      const dateLabel = useDateRange
        ? `${dateStart}_${dateEnd}`
        : `TY${taxYear}`
      const filename = `cost-basis-${method}-${selectedAsset}-${dateLabel}`

      if (format === 'csv') {
        downloadFile(
          exportReportCSV(reportData, method),
          `${filename}.csv`,
          'text/csv'
        )
      } else {
        downloadFile(
          exportReportJSON(reportData, method),
          `${filename}.json`,
          'application/json'
        )
      }
      setShowExportMenu(false)
    },
    [
      reportData,
      method,
      selectedAsset,
      taxYear,
      useDateRange,
      dateStart,
      dateEnd,
    ]
  )

  const toggleDisposal = useCallback((id: string) => {
    setExpandedDisposal(prev => (prev === id ? null : id))
  }, [])

  // Lot validation warnings
  const validationWarnings = useMemo(() => {
    if (!reportData?.lots.length) return null
    const result = validateLots(reportData.lots)
    return result.isValid ? null : result.errors
  }, [reportData])

  const weightedAvg = useMemo(() => {
    if (!reportData?.remainingLots.length) return '0'
    return calculateWeightedAverage(reportData.remainingLots)
  }, [reportData])

  const totalRealized = parseFloat(reportData?.totalRealizedGain ?? '0')

  // Tax year options (last 5 years)
  const yearOptions = useMemo(() => {
    const current = getCurrentTaxYear()
    return Array.from({ length: 5 }, (_, i) => current - i)
  }, [])

  return (
    <div className="min-h-screen ledger-background">
      {/* Header */}
      <header className="bg-[#F7FAFA] dark:bg-[#0C141B] border-b border-[rgba(95,227,192,0.15)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/reports')}
                className="p-2 mr-3 text-[#294050] dark:text-[#9FB4BE] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B] rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <p className="eyebrow">Cost Basis</p>
                <h1 className="text-lg font-semibold text-[#11202B] dark:text-[#EAF3F2]">
                  Cost Basis Report
                </h1>
                <p className="text-sm text-[#294050] dark:text-[#9FB4BE]">
                  Realized gains/losses by cost basis method
                </p>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(prev => !prev)}
                disabled={!reportData || reportData.disposals.length === 0}
                className="px-4 py-2 text-sm font-medium text-white bg-[#294050] rounded-lg hover:bg-[#1E2F3C] disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              {showExportMenu && (
                <div className="absolute right-0 mt-1 w-36 bg-[#F7FAFA] dark:bg-[#11202B] border border-[rgba(95,227,192,0.15)] rounded-lg shadow-lg z-10">
                  <button
                    onClick={() => handleExport('csv')}
                    className="w-full px-4 py-2 text-sm text-left text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] rounded-t-lg"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={() => handleExport('json')}
                    className="w-full px-4 py-2 text-sm text-left text-[#11202B] dark:text-[#EAF3F2] hover:bg-[#EAF3F2] dark:hover:bg-[#16242F] rounded-b-lg"
                  >
                    Export JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Validation warnings */}
        {validationWarnings && (
          <div className="mb-6 bg-[#E8B36F]/10 dark:bg-[#E8B36F]/5 border border-[#E8B36F]/30 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-[#E8B36F] mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#E8B36F]">
                  Lot data warnings
                </p>
                {validationWarnings.map(w => (
                  <p key={w} className="text-xs text-[#E8B36F]/80 mt-1">
                    {w}
                  </p>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-6 mb-6">
          <div className="flex items-center mb-4">
            <Filter className="w-4 h-4 text-[#294050] dark:text-[#9FB4BE] mr-2" />
            <h2 className="text-sm font-semibold text-[#11202B] dark:text-[#EAF3F2]">
              Report Parameters
            </h2>
          </div>

          {/* Method selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-2">
              Cost Basis Method
            </label>
            <MethodSelector selected={method} onChange={setMethod} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Asset selector */}
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-2">
                Asset
              </label>
              <select
                value={selectedAsset}
                onChange={e => setSelectedAsset(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
              >
                <option value="all">All Assets</option>
                {assets.map(a => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            {/* Tax year / date range toggle */}
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-2">
                Period
              </label>
              {!useDateRange ? (
                <div className="flex items-center gap-2">
                  <select
                    value={taxYear}
                    onChange={e => setTaxYear(parseInt(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
                  >
                    {yearOptions.map(y => (
                      <option key={y} value={y}>
                        Tax Year {y}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => setUseDateRange(true)}
                    className="px-3 py-2 text-xs text-[#294050] dark:text-[#9FB4BE] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
                    title="Use custom date range"
                  >
                    Custom
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateStart}
                    onChange={e => setDateStart(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
                  />
                  <span className="text-[#647D8B] text-xs">to</span>
                  <input
                    type="date"
                    value={dateEnd}
                    onChange={e => setDateEnd(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#F7FAFA] dark:bg-[#11202B] text-[#11202B] dark:text-[#EAF3F2] text-sm focus:outline-none focus:ring-2 focus:ring-[#5FE3C0]"
                  />
                  <button
                    onClick={() => setUseDateRange(false)}
                    className="px-3 py-2 text-xs text-[#294050] dark:text-[#9FB4BE] border border-[rgba(95,227,192,0.15)] rounded-lg hover:bg-[#EAF3F2] dark:hover:bg-[#16242F]"
                    title="Use tax year"
                  >
                    Year
                  </button>
                </div>
              )}
            </div>

            {/* Weighted average display */}
            <div>
              <label className="block text-xs font-medium text-[#294050] dark:text-[#9FB4BE] uppercase tracking-wider mb-2">
                Weighted Avg Cost/Unit
              </label>
              <div className="px-3 py-2 rounded-lg border border-[rgba(95,227,192,0.15)] bg-[#EAF3F2] dark:bg-[#16242F] text-[#11202B] dark:text-[#EAF3F2] text-sm font-mono tabular-nums">
                {formatNumber(weightedAvg)}
              </div>
            </div>
          </div>
        </div>

        {/* Loading / Error / Empty states */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-[#294050] animate-spin" />
            <span className="ml-3 text-[#294050] dark:text-[#9FB4BE]">
              Loading transactions...
            </span>
          </div>
        )}

        {error && (
          <div className="bg-[#E8836F]/10 border border-[#E8836F]/30 rounded-lg p-6 text-center">
            <AlertCircle className="mx-auto w-8 h-8 text-[#E8836F] mb-2" />
            <p className="text-sm text-[#E8836F]">{error}</p>
          </div>
        )}

        {!loading && !error && transactions.length === 0 && (
          <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)] p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-[#647D8B]" />
            <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
              No transaction data
            </h3>
            <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
              Add wallets and sync transactions to generate cost basis reports.
            </p>
          </div>
        )}

        {!loading && !error && reportData && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                label="Total Realized Gain/Loss"
                value={`${totalRealized >= 0 ? '+' : ''}${formatNumber(reportData.totalRealizedGain)}`}
                isPositive={totalRealized >= 0}
                Icon={Calculator}
              />
              <SummaryCard
                label="Short-term Gain/Loss"
                value={formatNumber(reportData.totalShortTermGain)}
                isPositive={parseFloat(reportData.totalShortTermGain) >= 0}
                Icon={TrendingDown}
              />
              <SummaryCard
                label="Long-term Gain/Loss"
                value={formatNumber(reportData.totalLongTermGain)}
                isPositive={parseFloat(reportData.totalLongTermGain) >= 0}
                Icon={TrendingUp}
              />
              <SummaryCard
                label="Disposals"
                value={reportData.disposals.length.toString()}
                Icon={FileText}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setActiveTab('disposals')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  activeTab === 'disposals'
                    ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988] border-[#294050]/30'
                    : 'bg-[#F7FAFA] dark:bg-[#0C141B] text-[#294050] dark:text-[#9FB4BE] border-[rgba(95,227,192,0.15)] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
                }`}
              >
                Realized Gains/Losses ({reportData.disposals.length})
              </button>
              <button
                onClick={() => setActiveTab('holdings')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                  activeTab === 'holdings'
                    ? 'bg-[#294050]/10 dark:bg-[#294050]/20 text-[#294050] dark:text-[#F09988] border-[#294050]/30'
                    : 'bg-[#F7FAFA] dark:bg-[#0C141B] text-[#294050] dark:text-[#9FB4BE] border-[rgba(95,227,192,0.15)] hover:bg-[#EAF3F2] dark:hover:bg-[#11202B]'
                }`}
              >
                Remaining Holdings ({reportData.remainingLots.length})
              </button>
            </div>

            {/* Data tables */}
            <div className="bg-[#F7FAFA] dark:bg-[#0C141B] rounded-lg border border-[rgba(95,227,192,0.15)]">
              {activeTab === 'disposals' ? (
                reportData.disposals.length > 0 ? (
                  <DisposalTable
                    disposals={reportData.disposals}
                    expandedId={expandedDisposal}
                    onToggle={toggleDisposal}
                  />
                ) : (
                  <div className="p-12 text-center">
                    <Calculator className="mx-auto h-12 w-12 text-[#647D8B]" />
                    <h3 className="mt-2 text-sm font-medium text-[#11202B] dark:text-[#EAF3F2]">
                      No disposals in this period
                    </h3>
                    <p className="mt-1 text-sm text-[#294050] dark:text-[#9FB4BE]">
                      No outgoing transactions found for the selected filters.
                    </p>
                  </div>
                )
              ) : (
                <RemainingLotsTable lots={reportData.remainingLots} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default CostBasisReport
