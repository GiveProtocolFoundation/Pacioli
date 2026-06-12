import { describe, it, expect } from 'vitest'
import type { StoredTransaction } from '../../../services/persistence'
import {
  buildLotsFromTransactions,
  buildDisposalsFromTransactions,
  computeReport,
  exportReportCSV,
  exportReportJSON,
} from '../CostBasisReport'

// ─── Test data ───────────────────────────────────────────────────────────────

function makeTx(
  overrides: Partial<StoredTransaction> & { id: string }
): StoredTransaction {
  return {
    wallet_id: 'w1',
    hash: `0x${overrides.id}`,
    chain: 'polkadot',
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  }
}

const sampleTransactions: StoredTransaction[] = [
  makeTx({
    id: 'tx1',
    tx_type: 'receive',
    token_symbol: 'DOT',
    value: '100',
    fee: '500',
    timestamp: '2025-01-15T00:00:00Z',
    to_address: '0xABC',
  }),
  makeTx({
    id: 'tx2',
    tx_type: 'receive',
    token_symbol: 'DOT',
    value: '50',
    fee: '600',
    timestamp: '2025-03-20T00:00:00Z',
    to_address: '0xABC',
  }),
  makeTx({
    id: 'tx3',
    tx_type: 'send',
    token_symbol: 'DOT',
    value: '30',
    fee: '200',
    timestamp: '2025-06-10T00:00:00Z',
    from_address: '0xABC',
  }),
  makeTx({
    id: 'tx4',
    tx_type: 'receive',
    token_symbol: 'KSM',
    value: '10',
    fee: '100',
    timestamp: '2025-02-01T00:00:00Z',
  }),
  makeTx({
    id: 'tx5',
    tx_type: 'send',
    token_symbol: 'KSM',
    value: '5',
    fee: '80',
    timestamp: '2025-07-01T00:00:00Z',
  }),
]

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CostBasisReport data wiring', () => {
  describe('buildLotsFromTransactions', () => {
    it('creates lots only from incoming transactions', () => {
      const lots = buildLotsFromTransactions(sampleTransactions)
      // tx1, tx2 = DOT receives; tx4 = KSM receive → 3 lots
      expect(lots).toHaveLength(3)
      expect(lots.every(l => parseFloat(l.quantity) > 0)).toBe(true)
    })

    it('filters by asset when specified', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      expect(lots).toHaveLength(2)
      expect(lots[0].lotId).toBe('tx1')
      expect(lots[1].lotId).toBe('tx2')
    })

    it('sets correct quantities from transaction value', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      expect(lots[0].quantity).toBe('100')
      expect(lots[0].remainingQuantity).toBe('100')
      expect(lots[1].quantity).toBe('50')
    })

    it('sorts lots by acquisition date ascending', () => {
      const lots = buildLotsFromTransactions(sampleTransactions)
      for (let i = 1; i < lots.length; i++) {
        expect(
          new Date(lots[i].acquisitionDate).getTime()
        ).toBeGreaterThanOrEqual(
          new Date(lots[i - 1].acquisitionDate).getTime()
        )
      }
    })

    it('skips transactions with zero or missing value', () => {
      const txs = [
        makeTx({ id: 'z1', tx_type: 'receive', value: '0', token_symbol: 'X' }),
        makeTx({ id: 'z2', tx_type: 'receive', value: null, token_symbol: 'X' }),
      ]
      expect(buildLotsFromTransactions(txs)).toHaveLength(0)
    })

    it('computes costPerUnit from fee / quantity', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      // tx1: fee=500, quantity=100 → costPerUnit = 5
      expect(lots[0].costPerUnit).toBe('5')
      // tx2: fee=600, quantity=50 → costPerUnit = 12
      expect(lots[1].costPerUnit).toBe('12')
    })
  })

  describe('buildDisposalsFromTransactions', () => {
    it('creates disposal records from outgoing transactions', () => {
      const disposals = buildDisposalsFromTransactions(sampleTransactions)
      // tx3 = DOT send, tx5 = KSM send → 2 disposals
      expect(disposals).toHaveLength(2)
    })

    it('filters by asset', () => {
      const disposals = buildDisposalsFromTransactions(
        sampleTransactions,
        'DOT'
      )
      expect(disposals).toHaveLength(1)
      expect(disposals[0].assetSymbol).toBe('DOT')
      expect(disposals[0].quantity).toBe('30')
    })

    it('sorts disposals chronologically', () => {
      const disposals = buildDisposalsFromTransactions(sampleTransactions)
      expect(
        new Date(disposals[0].date).getTime()
      ).toBeLessThanOrEqual(new Date(disposals[1].date).getTime())
    })
  })

  describe('computeReport', () => {
    it('computes FIFO report for DOT', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, disposals, 'FIFO')

      expect(report.disposals).toHaveLength(1)
      expect(report.disposals[0].quantity).toBe('30')
      // FIFO: uses oldest lot first (tx1, costPerUnit=5)
      // 30 units * 5 = 150 cost basis
      expect(report.disposals[0].result.totalCostBasis).toBe('150')
    })

    it('computes HIFO report using highest cost lot first', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, disposals, 'HIFO')

      // HIFO: uses highest cost lot first (tx2, costPerUnit=12)
      // 30 units needed: 50 available in tx2 → take 30 from tx2
      // 30 * 12 = 360
      expect(report.disposals[0].result.totalCostBasis).toBe('360')
    })

    it('updates remaining lots after disposal', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, disposals, 'FIFO')

      // After FIFO disposal of 30 from lot1 (had 100):
      // lot1 remaining = 70, lot2 remaining = 50
      expect(report.remainingLots).toHaveLength(2)
      const lot1 = report.remainingLots.find(l => l.lotId === 'tx1')
      expect(lot1?.remainingQuantity).toBe('70')
    })

    it('filters disposals by date range', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      // tx3 disposal is on 2025-06-10 — filter to only Q1
      const report = computeReport(
        lots,
        disposals,
        'FIFO',
        '2025-01-01T00:00:00Z',
        '2025-03-31T23:59:59Z'
      )

      expect(report.disposals).toHaveLength(0)
    })

    it('includes disposals within the date range', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(
        lots,
        disposals,
        'FIFO',
        '2025-01-01T00:00:00Z',
        '2025-12-31T23:59:59Z'
      )

      expect(report.disposals).toHaveLength(1)
    })

    it('calculates gain/loss correctly', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, disposals, 'FIFO')

      // proceeds=200 (fee on tx3), costBasis=150 (FIFO)
      // gain = 200 - 150 = 50
      expect(report.disposals[0].gainLoss.gainLoss).toBe('50')
      expect(report.disposals[0].gainLoss.isGain).toBe(true)
    })

    it('computes holding period', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, disposals, 'FIFO')

      // Acquisition: 2025-01-15, Disposal: 2025-06-10 → ~146 days → short-term
      expect(report.disposals[0].holdingPeriod.days).toBeGreaterThan(100)
      expect(report.disposals[0].holdingPeriod.isLongTerm).toBe(false)
    })

    it('handles empty disposals gracefully', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')

      const report = computeReport(lots, [], 'FIFO')

      expect(report.disposals).toHaveLength(0)
      expect(report.totalRealizedGain).toBe('0.000000')
      expect(report.remainingLots).toHaveLength(2)
    })
  })

  describe('export functions', () => {
    it('exportReportCSV produces valid CSV', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')
      const report = computeReport(lots, disposals, 'FIFO')

      const csv = exportReportCSV(report, 'FIFO')

      expect(csv).toContain('Date,Asset,Quantity,Proceeds,Cost Basis,Gain/Loss')
      expect(csv).toContain('DOT')
      expect(csv).toContain('Method,FIFO')
      expect(csv).toContain('Remaining Lots')
    })

    it('exportReportJSON produces valid JSON', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')
      const report = computeReport(lots, disposals, 'LIFO')

      const json = exportReportJSON(report, 'LIFO')
      const parsed = JSON.parse(json)

      expect(parsed.method).toBe('LIFO')
      expect(parsed.summary.disposalCount).toBe(1)
      expect(parsed.disposals).toHaveLength(1)
      expect(parsed.disposals[0].lotAllocations).toBeDefined()
      expect(parsed.remainingLots).toHaveLength(2)
    })

    it('export JSON matches on-screen values', () => {
      const lots = buildLotsFromTransactions(sampleTransactions, 'DOT')
      const disposals = buildDisposalsFromTransactions(sampleTransactions, 'DOT')
      const report = computeReport(lots, disposals, 'FIFO')

      const parsed = JSON.parse(exportReportJSON(report, 'FIFO'))

      expect(parsed.summary.totalRealizedGain).toBe(report.totalRealizedGain)
      expect(parsed.summary.shortTermGain).toBe(report.totalShortTermGain)
      expect(parsed.summary.longTermGain).toBe(report.totalLongTermGain)
      expect(parsed.disposals[0].costBasis).toBe(
        report.disposals[0].result.totalCostBasis
      )
    })
  })
})
