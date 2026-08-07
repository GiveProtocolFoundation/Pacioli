/**
 * GIV-830: Dedup and re-import safety tests
 * Anti-metric: duplicate posting rate on statement re-import < 0.1% (PRD §4)
 */

import { describe, it, expect } from 'vitest'
import { parseCsv } from '../csvParser'
import { parseOfx } from '../ofxParser'
import type { CsvParseOptions } from '../types'

// ─── Test Helpers ────────────────────────────────────────────────────────────

function toExternalIdSet(
  txs: Array<{ external_id?: string | null }>
): Set<string> {
  const s = new Set<string>()
  for (const tx of txs) {
    if (tx.external_id) s.add(tx.external_id)
  }
  return s
}

interface OfxTx {
  fitid: string
  date: string
  amount: string
  name: string
}

function makeOfx(txs: OfxTx[]): string {
  const stmtTrns = txs
    .map(
      t =>
        `<STMTTRN>\n<TRNTYPE>DEBIT\n<DTPOSTED>${t.date}\n<TRNAMT>${t.amount}\n<FITID>${t.fitid}\n<NAME>${t.name}\n</STMTTRN>`
    )
    .join('\n')
  return [
    'OFXHEADER:100',
    'DATA:OFXSGML',
    '<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>USD',
    '<BANKTRANLIST>',
    stmtTrns,
    '</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>',
  ].join('\n')
}

interface CsvRow {
  date: string
  payee: string
  amount: string
}

function makeCsv(rows: CsvRow[]): string {
  return [
    'Date,Payee,Amount',
    ...rows.map(r => `${r.date},${r.payee},${r.amount}`),
  ].join('\n')
}

const csvOpts: CsvParseOptions = {
  bankAccountId: 'acct-test',
  columnMap: { date: 'Date', amount: 'Amount', payee: 'Payee' },
  dateFormat: 'YYYY-MM-DD',
  amountSignConvention: 'signed',
  currencyDefault: 'USD',
}

// ─── Property: dedup invariant on synthetic OFX overlap ──────────────────────
//
// For any pair of OFX statements with N shared FITIDs and M unique FITIDs in
// the second file, re-importing the second file must flag exactly N duplicates
// and pass exactly M unique rows. Zero false positives on genuinely-new rows.

describe('property: dedup invariant on synthetic OFX overlap', () => {
  const cases = [
    { overlap: 0, uniqueInB: 5 },
    { overlap: 1, uniqueInB: 10 },
    { overlap: 3, uniqueInB: 3 },
    { overlap: 5, uniqueInB: 0 },
    { overlap: 10, uniqueInB: 10 },
    { overlap: 50, uniqueInB: 50 },
  ]

  for (const { overlap, uniqueInB } of cases) {
    it(`${overlap} overlapping + ${uniqueInB} new → exactly ${uniqueInB} pass dedup`, () => {
      const sharedTxs: OfxTx[] = Array.from({ length: overlap }, (_, i) => ({
        fitid: `SHARED-${i + 1}`,
        date: `202601${String((i % 28) + 1).padStart(2, '0')}`,
        amount: `-${(i + 1) * 10}.00`,
        name: `SHARED MERCHANT ${i + 1}`,
      }))
      const uniqueTxs: OfxTx[] = Array.from({ length: uniqueInB }, (_, i) => ({
        fitid: `UNIQUE-${i + 1}`,
        date: `202602${String((i % 28) + 1).padStart(2, '0')}`,
        amount: `-${(i + 1) * 7}.00`,
        name: `UNIQUE MERCHANT ${i + 1}`,
      }))

      // First import (statement A = shared transactions)
      const resultA = parseOfx(makeOfx(sharedTxs), {
        bankAccountId: 'acct-test',
      })
      const existingIds = toExternalIdSet(resultA.transactions)

      // Second import (statement B = shared + unique)
      const resultB = parseOfx(makeOfx([...sharedTxs, ...uniqueTxs]), {
        bankAccountId: 'acct-test',
        existingExternalIds: existingIds,
      })

      const dupeCount = resultB.transactions.filter(t => t._isDuplicate).length
      const passCount = resultB.transactions.filter(t => !t._isDuplicate).length

      expect(dupeCount).toBe(overlap)
      expect(passCount).toBe(uniqueInB)
      expect(resultB.duplicateCount).toBe(overlap)

      // No false positives: genuinely-new FITIDs must never be flagged as duplicate
      const sharedFitids = new Set(sharedTxs.map(s => s.fitid))
      const falsePositives = resultB.transactions.filter(
        t => t._isDuplicate && !sharedFitids.has(t.external_id ?? '')
      )
      expect(falsePositives).toHaveLength(0)
    })
  }
})

// ─── Property: dedup invariant on synthetic CSV overlap ──────────────────────
//
// CSV rows use a hash(date+amount+payee+lineNumber) external_id. When the same
// file is imported a second time, all rows must be flagged as duplicates.

describe('property: dedup invariant on synthetic CSV overlap', () => {
  const sizes = [1, 5, 10, 25, 50]

  for (const n of sizes) {
    it(`CSV with ${n} rows re-imported → all ${n} marked duplicate`, () => {
      const rows: CsvRow[] = Array.from({ length: n }, (_, i) => ({
        date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
        payee: `MERCHANT ${i + 1}`,
        amount: `-${(i + 1) * 11}.50`,
      }))
      const content = makeCsv(rows)

      const r1 = parseCsv(content, csvOpts)
      expect(r1.duplicateCount).toBe(0)
      const existingIds = toExternalIdSet(r1.transactions)

      const r2 = parseCsv(content, {
        ...csvOpts,
        existingExternalIds: existingIds,
      })
      expect(r2.duplicateCount).toBe(n)
      expect(r2.transactions.every(t => t._isDuplicate)).toBe(true)
    })
  }
})

// ─── Re-import same statement 3× → row count invariant ──────────────────────

describe('re-import same statement 3× → row count invariant', () => {
  it('OFX: 10 transactions re-imported 3× → 0 net new rows on each re-import', () => {
    const txs: OfxTx[] = Array.from({ length: 10 }, (_, i) => ({
      fitid: `TX-${i + 1}`,
      date: `202607${String(i + 1).padStart(2, '0')}`,
      amount: `-${(i + 1) * 10}.00`,
      name: `MERCHANT ${i + 1}`,
    }))
    const content = makeOfx(txs)

    const r1 = parseOfx(content, { bankAccountId: 'acct-test' })
    expect(r1.transactions.filter(t => !t._isDuplicate)).toHaveLength(10)

    const existingIds = toExternalIdSet(r1.transactions)

    for (let pass = 2; pass <= 4; pass++) {
      const r = parseOfx(content, {
        bankAccountId: 'acct-test',
        existingExternalIds: existingIds,
      })
      expect(r.duplicateCount).toBe(10)
      expect(r.transactions.filter(t => !t._isDuplicate)).toHaveLength(0)
    }
  })

  it('CSV: 10 transactions re-imported 3× → row count stays at 10', () => {
    const rows: CsvRow[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      payee: `MERCHANT ${i + 1}`,
      amount: `-${(i + 1) * 10}.50`,
    }))
    const content = makeCsv(rows)

    const r1 = parseCsv(content, csvOpts)
    const existingIds = toExternalIdSet(r1.transactions)

    for (let pass = 2; pass <= 4; pass++) {
      const r = parseCsv(content, {
        ...csvOpts,
        existingExternalIds: existingIds,
      })
      expect(r.duplicateCount).toBe(10)
      expect(r.transactions.filter(t => !t._isDuplicate)).toHaveLength(0)
    }
  })
})

// ─── Overlapping-but-not-identical statements → correct incremental ───────────

describe('overlapping-but-not-identical statements → correct incremental', () => {
  it('OFX: Jan (10 tx) then Jan+Feb combined (20 tx) → 10 new on second import', () => {
    const janTxs: OfxTx[] = Array.from({ length: 10 }, (_, i) => ({
      fitid: `JAN-${i + 1}`,
      date: `202601${String(i + 1).padStart(2, '0')}`,
      amount: `-${(i + 1) * 15}.00`,
      name: `JAN MERCHANT ${i + 1}`,
    }))
    const febTxs: OfxTx[] = Array.from({ length: 10 }, (_, i) => ({
      fitid: `FEB-${i + 1}`,
      date: `202602${String(i + 1).padStart(2, '0')}`,
      amount: `-${(i + 1) * 20}.00`,
      name: `FEB MERCHANT ${i + 1}`,
    }))

    // First import: January statement
    const r1 = parseOfx(makeOfx(janTxs), { bankAccountId: 'acct-test' })
    expect(r1.transactions).toHaveLength(10)
    const existingIds = toExternalIdSet(r1.transactions)

    // Second import: Jan+Feb combined statement
    const r2 = parseOfx(makeOfx([...janTxs, ...febTxs]), {
      bankAccountId: 'acct-test',
      existingExternalIds: existingIds,
    })

    expect(r2.transactions.filter(t => t._isDuplicate)).toHaveLength(10)
    expect(r2.transactions.filter(t => !t._isDuplicate)).toHaveLength(10)
    expect(r2.duplicateCount).toBe(10)

    // Verify the duplicates are exactly the Jan transactions
    const dupeFitids = r2.transactions
      .filter(t => t._isDuplicate)
      .map(t => t.external_id)
    for (let i = 1; i <= 10; i++) {
      expect(dupeFitids).toContain(`JAN-${i}`)
    }
  })

  it('CSV: Jan file then Jan+Feb combined → Jan rows duplicate, Feb rows new', () => {
    const janRows: CsvRow[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      payee: `JAN VENDOR ${i + 1}`,
      amount: `-${(i + 1) * 12}.00`,
    }))
    const febRows: CsvRow[] = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-02-${String(i + 1).padStart(2, '0')}`,
      payee: `FEB VENDOR ${i + 1}`,
      amount: `-${(i + 1) * 12}.00`,
    }))

    // First import: January statement
    const r1 = parseCsv(makeCsv(janRows), csvOpts)
    expect(r1.transactions).toHaveLength(5)
    const existingIds = toExternalIdSet(r1.transactions)

    // Second import: Jan+Feb combined. Jan rows appear at same line positions
    // (header=line 0, Jan rows=lines 1-5), so their hashes match the first import.
    const r2 = parseCsv(makeCsv([...janRows, ...febRows]), {
      ...csvOpts,
      existingExternalIds: existingIds,
    })

    expect(r2.transactions.filter(t => t._isDuplicate)).toHaveLength(5)
    expect(r2.transactions.filter(t => !t._isDuplicate)).toHaveLength(5)
    expect(r2.duplicateCount).toBe(5)
  })
})

// ─── Amend/edit an already-imported row → dedup still fires on re-parse ──────

describe('amend/edit an already-imported row', () => {
  it('OFX: editing a stored rows payee/memo does not defeat dedup on re-parse of original file', () => {
    const content = makeOfx([
      {
        fitid: 'TX-1',
        date: '20260701',
        amount: '-50.00',
        name: 'COFFEE SHOP',
      },
      { fitid: 'TX-2', date: '20260702', amount: '-100.00', name: 'GROCERY' },
      { fitid: 'TX-3', date: '20260703', amount: '-25.00', name: 'PHARMACY' },
    ])

    // Initial import
    const r1 = parseOfx(content, { bankAccountId: 'acct-test' })
    const existingIds = toExternalIdSet(r1.transactions)
    expect(existingIds.size).toBe(3)

    // Simulate user editing the stored rows: the BankTransaction in DB has its
    // payee/memo/classification changed, but external_id is immutable.
    // Re-parsing the SAME original file must still detect all 3 as duplicates.
    const r2 = parseOfx(content, {
      bankAccountId: 'acct-test',
      existingExternalIds: existingIds,
    })

    expect(r2.duplicateCount).toBe(3)
    expect(r2.transactions.every(t => t._isDuplicate)).toBe(true)
  })

  it('CSV: editing a stored row in DB does not break hash-based dedup on re-parse', () => {
    const rows: CsvRow[] = [
      { date: '2026-07-01', payee: 'COFFEE SHOP', amount: '-4.50' },
      { date: '2026-07-01', payee: 'GROCERY STORE', amount: '-89.20' },
    ]
    const content = makeCsv(rows)

    // First import
    const r1 = parseCsv(content, csvOpts)
    const existingIds = toExternalIdSet(r1.transactions)
    expect(existingIds.size).toBe(2)

    // Re-parse original file after simulated edit → hashes still match
    const r2 = parseCsv(content, {
      ...csvOpts,
      existingExternalIds: existingIds,
    })
    expect(r2.duplicateCount).toBe(2)
    expect(r2.transactions.every(t => t._isDuplicate)).toBe(true)
  })
})

// ─── Negative test: two genuinely-different rows, same date+amount+payee ──────

describe('negative test: two identical-looking rows that are genuinely different', () => {
  it('CSV: two coffee purchases same date+amount+payee get distinct external_ids (line-number salt)', () => {
    // Two genuinely-separate transactions that look identical in the data
    const content = makeCsv([
      { date: '2026-07-01', payee: 'COFFEE SHOP', amount: '-4.50' },
      { date: '2026-07-01', payee: 'COFFEE SHOP', amount: '-4.50' },
    ])

    // First parse: no existing IDs → both must pass as unique (zero false duplicates)
    const r1 = parseCsv(content, csvOpts)
    expect(r1.transactions).toHaveLength(2)
    expect(r1.duplicateCount).toBe(0)

    // Both external_ids must be distinct (line number differentiates them)
    const [id1, id2] = r1.transactions.map(t => t.external_id)
    expect(id1).toBeDefined()
    expect(id2).toBeDefined()
    expect(id1).not.toBe(id2)
    expect(id1).toMatch(/^csv_/)
    expect(id2).toMatch(/^csv_/)

    // After storing both: re-import correctly marks both as duplicates (not lost)
    const existingIds = toExternalIdSet(r1.transactions)
    const r2 = parseCsv(content, {
      ...csvOpts,
      existingExternalIds: existingIds,
    })
    expect(r2.duplicateCount).toBe(2)
  })

  it('OFX: two same-amount transactions from same merchant have different FITIDs → both unique', () => {
    const content = makeOfx([
      {
        fitid: 'COFFEE-001',
        date: '20260701',
        amount: '-4.50',
        name: 'COFFEE SHOP',
      },
      {
        fitid: 'COFFEE-002',
        date: '20260701',
        amount: '-4.50',
        name: 'COFFEE SHOP',
      },
    ])

    const r1 = parseOfx(content, { bankAccountId: 'acct-test' })
    expect(r1.transactions).toHaveLength(2)
    expect(r1.duplicateCount).toBe(0)
    expect(r1.transactions[0].external_id).toBe('COFFEE-001')
    expect(r1.transactions[1].external_id).toBe('COFFEE-002')
  })
})

// ─── Anti-metric: duplicate posting rate < 0.1% on large re-import ───────────

describe('anti-metric: false duplicate rate < 0.1% on large statement re-import', () => {
  it('100-tx OFX: re-import adds 100 new rows → 0 false positives (0.0% false dup rate)', () => {
    const existingTxs: OfxTx[] = Array.from({ length: 100 }, (_, i) => ({
      fitid: `EXISTING-${i + 1}`,
      date: `2026${String(Math.floor(i / 25) + 1).padStart(2, '0')}${String((i % 25) + 1).padStart(2, '0')}`,
      amount: `-${((i * 7 + 3) % 99) + 1}.00`,
      name: `EXISTING MERCHANT ${i + 1}`,
    }))
    const newTxs: OfxTx[] = Array.from({ length: 100 }, (_, i) => ({
      fitid: `NEW-${i + 1}`,
      date: `2026${String(Math.floor(i / 25) + 5).padStart(2, '0')}${String((i % 25) + 1).padStart(2, '0')}`,
      amount: `-${((i * 13 + 5) % 200) + 1}.00`,
      name: `NEW MERCHANT ${i + 1}`,
    }))

    // Build existing DB state from first import
    const r1 = parseOfx(makeOfx(existingTxs), { bankAccountId: 'acct-test' })
    expect(r1.duplicateCount).toBe(0)
    const existingIds = toExternalIdSet(r1.transactions)

    // Re-verify: re-importing existing 100 = 100% detection, 0 false negatives
    const r2 = parseOfx(makeOfx(existingTxs), {
      bankAccountId: 'acct-test',
      existingExternalIds: existingIds,
    })
    expect(r2.duplicateCount).toBe(100)

    // Import 100 genuinely new alongside existing 100
    const r3 = parseOfx(makeOfx([...existingTxs, ...newTxs]), {
      bankAccountId: 'acct-test',
      existingExternalIds: existingIds,
    })

    const newFitids = new Set(newTxs.map(n => n.fitid))
    const falsePositives = r3.transactions.filter(
      t => t._isDuplicate && newFitids.has(t.external_id ?? '')
    )

    const falsePositiveRate = falsePositives.length / newTxs.length
    expect(falsePositiveRate).toBeLessThan(0.001) // < 0.1% — PRD §4
    expect(falsePositives).toHaveLength(0)
  })

  it('100-tx CSV: re-import adds 100 new rows → 0 false positives', () => {
    const existingRows: CsvRow[] = Array.from({ length: 100 }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
      payee: `EXISTING VENDOR ${i + 1}`,
      amount: `-${(i + 1) * 3}.75`,
    }))

    const r1 = parseCsv(makeCsv(existingRows), csvOpts)
    expect(r1.duplicateCount).toBe(0)
    const existingIds = toExternalIdSet(r1.transactions)

    // Re-import same file: all 100 must be duplicates
    const r2 = parseCsv(makeCsv(existingRows), {
      ...csvOpts,
      existingExternalIds: existingIds,
    })
    expect(r2.duplicateCount).toBe(100)

    // Import a completely new set of 100 rows — none should be false-duped
    const newRows: CsvRow[] = Array.from({ length: 100 }, (_, i) => ({
      date: `2026-02-${String((i % 28) + 1).padStart(2, '0')}`,
      payee: `NEW VENDOR ${i + 1}`,
      amount: `-${(i + 1) * 4}.25`,
    }))
    const r3 = parseCsv(makeCsv(newRows), {
      ...csvOpts,
      existingExternalIds: existingIds,
    })
    expect(r3.duplicateCount).toBe(0)
    expect(r3.transactions.every(t => !t._isDuplicate)).toBe(true)
  })
})
