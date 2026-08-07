/**
 * GIV-830: Nightly canary — runs against fixtures/
 * Add real-world anonymized statement files to fixtures/ to grow the corpus.
 * Invariant: every fixture must parse without duplicates on first import and
 * flag 100% as duplicates on re-import.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseCsv } from '../csvParser'
import { parseOfx } from '../ofxParser'
import type { CsvParseOptions } from '../types'

const FIXTURES_DIR = join(import.meta.dirname, 'fixtures')

function toExternalIdSet(
  txs: Array<{ external_id?: string | null }>
): Set<string> {
  const s = new Set<string>()
  for (const tx of txs) {
    if (tx.external_id) s.add(tx.external_id)
  }
  return s
}

// ─── OFX Fixtures ────────────────────────────────────────────────────────────

describe('canary: OFX fixtures', () => {
  const fixtures = [
    { file: 'sample-checking.ofx', expectedCount: 10 },
  ]

  for (const { file, expectedCount } of fixtures) {
    describe(file, () => {
      it('parses without errors and returns expected row count', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r = parseOfx(content, { bankAccountId: `canary-${file}` })
        expect(r.transactions.length).toBeGreaterThanOrEqual(1)
        if (expectedCount) expect(r.transactions).toHaveLength(expectedCount)
        expect(r.duplicateCount).toBe(0)
        for (const tx of r.transactions) {
          expect(tx.external_id).toBeTruthy()
          expect(tx.amount).not.toBe('0')
          expect(tx.posted_date).toBeGreaterThan(0)
        }
      })

      it('re-import marks all rows as duplicate (0 double-posts)', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r1 = parseOfx(content, { bankAccountId: `canary-${file}` })
        const existingIds = toExternalIdSet(r1.transactions)

        const r2 = parseOfx(content, {
          bankAccountId: `canary-${file}`,
          existingExternalIds: existingIds,
        })

        expect(r2.duplicateCount).toBe(r1.transactions.length)
        const falseNegatives = r2.transactions.filter(t => !t._isDuplicate)
        expect(falseNegatives).toHaveLength(0)
      })

      it('three consecutive re-imports → row count invariant holds', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r1 = parseOfx(content, { bankAccountId: `canary-${file}` })
        const existingIds = toExternalIdSet(r1.transactions)
        const totalCount = r1.transactions.length

        for (let i = 0; i < 3; i++) {
          const r = parseOfx(content, {
            bankAccountId: `canary-${file}`,
            existingExternalIds: existingIds,
          })
          expect(r.duplicateCount).toBe(totalCount)
          expect(r.transactions.filter(t => !t._isDuplicate)).toHaveLength(0)
        }
      })
    })
  }
})

// ─── CSV Fixtures ─────────────────────────────────────────────────────────────

const csvDefaultOpts: Omit<CsvParseOptions, 'bankAccountId' | 'existingExternalIds'> = {
  columnMap: { date: 'Date', amount: 'Amount', payee: 'Description' },
  dateFormat: 'YYYY-MM-DD',
  amountSignConvention: 'signed',
  currencyDefault: 'USD',
}

describe('canary: CSV fixtures', () => {
  const fixtures = [
    { file: 'sample-credit.csv', expectedCount: 14 },
  ]

  for (const { file, expectedCount } of fixtures) {
    describe(file, () => {
      it('parses without errors and returns expected row count', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r = parseCsv(content, {
          ...csvDefaultOpts,
          bankAccountId: `canary-${file}`,
        })
        expect(r.transactions.length).toBeGreaterThanOrEqual(1)
        if (expectedCount) expect(r.transactions).toHaveLength(expectedCount)
        expect(r.duplicateCount).toBe(0)
        for (const tx of r.transactions) {
          expect(tx.external_id).toMatch(/^csv_/)
          expect(tx.posted_date).toBeGreaterThan(0)
        }
      })

      it('all rows get unique external_ids', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r = parseCsv(content, {
          ...csvDefaultOpts,
          bankAccountId: `canary-${file}`,
        })
        const ids = r.transactions.map(t => t.external_id)
        expect(new Set(ids).size).toBe(ids.length)
      })

      it('re-import marks all rows as duplicate (0 double-posts)', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r1 = parseCsv(content, {
          ...csvDefaultOpts,
          bankAccountId: `canary-${file}`,
        })
        const existingIds = toExternalIdSet(r1.transactions)

        const r2 = parseCsv(content, {
          ...csvDefaultOpts,
          bankAccountId: `canary-${file}`,
          existingExternalIds: existingIds,
        })

        expect(r2.duplicateCount).toBe(r1.transactions.length)
        expect(r2.transactions.every(t => t._isDuplicate)).toBe(true)
      })

      it('three consecutive re-imports → row count invariant holds', () => {
        const content = readFileSync(join(FIXTURES_DIR, file), 'utf-8')
        const r1 = parseCsv(content, {
          ...csvDefaultOpts,
          bankAccountId: `canary-${file}`,
        })
        const existingIds = toExternalIdSet(r1.transactions)
        const totalCount = r1.transactions.length

        for (let i = 0; i < 3; i++) {
          const r = parseCsv(content, {
            ...csvDefaultOpts,
            bankAccountId: `canary-${file}`,
            existingExternalIds: existingIds,
          })
          expect(r.duplicateCount).toBe(totalCount)
          expect(r.transactions.filter(t => !t._isDuplicate)).toHaveLength(0)
        }
      })
    })
  }
})
