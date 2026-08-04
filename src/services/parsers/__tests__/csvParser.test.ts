import { describe, it, expect } from 'vitest'
import { parseCsv, detectCsvFormat, inferColumnMap } from '../csvParser'
import type { CsvParseOptions } from '../types'

const SAMPLE_CSV = `Date,Description,Amount,Balance
2026-07-01,GROCERY STORE,-45.50,5280.00
2026-07-03,EMPLOYER INC,2500.00,7780.00
2026-07-05,ELECTRIC BILL,-120.00,7660.00
2026-07-08,ATM WITHDRAWAL,-200.00,7460.00
2026-07-10,RESTAURANT,-35.25,7424.75`

const QUOTED_CSV = `"Date","Payee","Memo","Amount","Balance"
"07/01/2026","GROCERY STORE","Weekly groceries","-45.50","5280.00"
"07/03/2026","EMPLOYER, INC","Direct deposit, payroll","2500.00","7780.00"
"07/05/2026","ELECTRIC ""BILL""","Monthly utility","-120.00","7660.00"`

const defaultOptions: CsvParseOptions = {
  bankAccountId: 'test-bank-1',
  columnMap: {
    date: 'Date',
    amount: 'Amount',
    payee: 'Description',
    balance: 'Balance',
  },
  dateFormat: 'YYYY-MM-DD',
  amountSignConvention: 'signed',
  currencyDefault: 'USD',
}

describe('detectCsvFormat', () => {
  it('should detect CSV with banking headers', () => {
    expect(detectCsvFormat(SAMPLE_CSV)).toBe(true)
  })

  it('should reject non-CSV content', () => {
    expect(detectCsvFormat('OFXHEADER:100\nDATA:OFXSGML')).toBe(false)
  })

  it('should reject single-line content', () => {
    expect(detectCsvFormat('just one line')).toBe(false)
  })

  it('should detect various header styles', () => {
    expect(detectCsvFormat('Transaction Date,Debit,Credit\n1,2,3')).toBe(true)
    expect(detectCsvFormat('posting date,amount,memo\n1,2,3')).toBe(true)
    expect(detectCsvFormat('Reference,Check,Balance\n1,2,3')).toBe(true)
  })
})

describe('inferColumnMap', () => {
  it('should map standard headers', () => {
    const headers = ['Date', 'Description', 'Amount', 'Balance']
    const map = inferColumnMap(headers)
    expect(map.date).toBe('Date')
    expect(map.amount).toBe('Amount')
    expect(map.payee).toBe('Description')
    expect(map.balance).toBe('Balance')
  })

  it('should map alternative header names', () => {
    const headers = ['Posted Date', 'Payee', 'Memo', 'Debit', 'Reference']
    const map = inferColumnMap(headers)
    expect(map.date).toBe('Posted Date')
    expect(map.payee).toBe('Payee')
    expect(map.memo).toBe('Memo')
    expect(map.amount).toBe('Debit')
    expect(map.referenceNumber).toBe('Reference')
  })
})

describe('parseCsv', () => {
  it('should parse all 5 data rows', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.transactions).toHaveLength(5)
    expect(result.format).toBe('csv')
    expect(result.totalCount).toBe(5)
  })

  it('should set correct amounts', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.transactions[0].amount).toBe('-45.5')
    expect(result.transactions[1].amount).toBe('2500')
    expect(result.transactions[2].amount).toBe('-120')
  })

  it('should set payees from description column', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.transactions[0].payee).toBe('GROCERY STORE')
    expect(result.transactions[1].payee).toBe('EMPLOYER INC')
  })

  it('should set running balance', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.transactions[0].running_balance).toBe('5280.00')
  })

  it('should parse dates correctly', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    const date = new Date(result.transactions[0].posted_date)
    expect(date.getUTCFullYear()).toBe(2026)
    expect(date.getUTCMonth()).toBe(6)
    expect(date.getUTCDate()).toBe(1)
  })

  it('should compute date range', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.dateRange).toBeDefined()
    if (!result.dateRange) return
    const start = new Date(result.dateRange.start)
    const end = new Date(result.dateRange.end)
    expect(start.getUTCDate()).toBe(1)
    expect(end.getUTCDate()).toBe(10)
  })

  it('should set currency from options', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    expect(result.currency).toBe('USD')
    for (const tx of result.transactions) {
      expect(tx.currency).toBe('USD')
    }
  })

  it('should set bank_account_id on all transactions', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    for (const tx of result.transactions) {
      expect(tx.bank_account_id).toBe('test-bank-1')
    }
  })

  it('should generate external_ids for all rows', () => {
    const result = parseCsv(SAMPLE_CSV, defaultOptions)
    const ids = result.transactions.map(t => t.external_id)
    expect(new Set(ids).size).toBe(5)
    for (const id of ids) {
      expect(id).toMatch(/^csv_/)
    }
  })

  describe('quoted CSV', () => {
    it('should handle quoted fields with commas', () => {
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: {
          date: 'Date',
          amount: 'Amount',
          payee: 'Payee',
          memo: 'Memo',
          balance: 'Balance',
        },
        dateFormat: 'MM/DD/YYYY',
      }
      const result = parseCsv(QUOTED_CSV, opts)
      expect(result.transactions).toHaveLength(3)
      expect(result.transactions[1].payee).toBe('EMPLOYER, INC')
      expect(result.transactions[1].memo).toBe('Direct deposit, payroll')
    })

    it('should handle escaped quotes', () => {
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: {
          date: 'Date',
          amount: 'Amount',
          payee: 'Payee',
          memo: 'Memo',
          balance: 'Balance',
        },
        dateFormat: 'MM/DD/YYYY',
      }
      const result = parseCsv(QUOTED_CSV, opts)
      expect(result.transactions[2].payee).toBe('ELECTRIC "BILL"')
    })
  })

  describe('date formats', () => {
    const makeOpts = (dateFormat: string): CsvParseOptions => ({
      ...defaultOptions,
      dateFormat,
    })

    it('should parse MM/DD/YYYY', () => {
      const csv = 'Date,Amount\n07/15/2026,100'
      const opts = makeOpts('MM/DD/YYYY')
      opts.columnMap = { date: 'Date', amount: 'Amount' }
      const result = parseCsv(csv, opts)
      const d = new Date(result.transactions[0].posted_date)
      expect(d.getUTCMonth()).toBe(6)
      expect(d.getUTCDate()).toBe(15)
    })

    it('should parse DD/MM/YYYY', () => {
      const csv = 'Date,Amount\n15/07/2026,100'
      const opts = makeOpts('DD/MM/YYYY')
      opts.columnMap = { date: 'Date', amount: 'Amount' }
      const result = parseCsv(csv, opts)
      const d = new Date(result.transactions[0].posted_date)
      expect(d.getUTCMonth()).toBe(6)
      expect(d.getUTCDate()).toBe(15)
    })

    it('should parse DD.MM.YYYY', () => {
      const csv = 'Date,Amount\n15.07.2026,100'
      const opts = makeOpts('DD.MM.YYYY')
      opts.columnMap = { date: 'Date', amount: 'Amount' }
      const result = parseCsv(csv, opts)
      const d = new Date(result.transactions[0].posted_date)
      expect(d.getUTCMonth()).toBe(6)
    })
  })

  describe('amount sign conventions', () => {
    const csv =
      'Date,Amount,Type\n2026-07-01,45.50,Debit\n2026-07-02,100.00,Credit'

    it('signed: passes through as-is', () => {
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount', type: 'Type' },
        amountSignConvention: 'signed',
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions[0].amount).toBe('45.5')
    })

    it('debit_positive: negates debit rows', () => {
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount', type: 'Type' },
        amountSignConvention: 'debit_positive',
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions[0].amount).toBe('-45.5')
      expect(result.transactions[1].amount).toBe('100')
    })

    it('debit_negative: passes through as-is', () => {
      const negCsv = 'Date,Amount\n2026-07-01,-45.50\n2026-07-02,100.00'
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount' },
        amountSignConvention: 'debit_negative',
      }
      const result = parseCsv(negCsv, opts)
      expect(result.transactions[0].amount).toBe('-45.5')
      expect(result.transactions[1].amount).toBe('100')
    })
  })

  describe('dedup', () => {
    it('should mark known external_ids as duplicates', () => {
      const result1 = parseCsv(SAMPLE_CSV, defaultOptions)
      const existingIds = new Set(
        result1.transactions.slice(0, 2).map(t => t.external_id!)
      )

      const opts: CsvParseOptions = {
        ...defaultOptions,
        existingExternalIds: existingIds,
      }
      const result2 = parseCsv(SAMPLE_CSV, opts)
      expect(result2.duplicateCount).toBe(2)
      expect(result2.transactions.filter(t => t._isDuplicate)).toHaveLength(2)
    })
  })

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = parseCsv('', defaultOptions)
      expect(result.transactions).toHaveLength(0)
    })

    it('should handle header-only', () => {
      const result = parseCsv('Date,Amount', defaultOptions)
      expect(result.transactions).toHaveLength(0)
    })

    it('should skip rows with invalid dates', () => {
      const csv = 'Date,Amount\nbaddate,100\n2026-07-01,200'
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount' },
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions).toHaveLength(1)
    })

    it('should handle currency symbols in amounts', () => {
      const csv = 'Date,Amount\n2026-07-01,"$1,234.56"'
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount' },
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions[0].amount).toBe('1234.56')
    })

    it('should skip custom header rows', () => {
      const csv = 'Bank Statement\nDate,Amount\n2026-07-01,100\n2026-07-02,200'
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount' },
        skipHeaderRows: 2,
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions).toHaveLength(2)
    })

    it('should handle Windows line endings', () => {
      const csv = 'Date,Amount\r\n2026-07-01,100\r\n2026-07-02,200'
      const opts: CsvParseOptions = {
        ...defaultOptions,
        columnMap: { date: 'Date', amount: 'Amount' },
      }
      const result = parseCsv(csv, opts)
      expect(result.transactions).toHaveLength(2)
    })
  })
})
