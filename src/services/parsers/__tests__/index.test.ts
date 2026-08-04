import { describe, it, expect } from 'vitest'
import { detectFormat, parseStatement, BANK_IMPORT_FLAG } from '../index'

describe('detectFormat', () => {
  it('should detect OFX by content', () => {
    expect(detectFormat('OFXHEADER:100\n<OFX>')).toBe('ofx')
  })

  it('should detect QFX by extension', () => {
    expect(detectFormat('OFXHEADER:100\n<OFX>', 'statement.qfx')).toBe('qfx')
  })

  it('should detect QBO by extension', () => {
    expect(detectFormat('OFXHEADER:100\n<OFX>', 'data.qbo')).toBe('qbo')
  })

  it('should detect OFX by extension', () => {
    expect(detectFormat('some content', 'file.ofx')).toBe('ofx')
  })

  it('should detect CSV by extension', () => {
    expect(detectFormat('Date,Amount\n1,2', 'stmt.csv')).toBe('csv')
  })

  it('should detect CSV by content', () => {
    expect(
      detectFormat('Date,Description,Amount\n2026-07-01,Test,100')
    ).toBe('csv')
  })

  it('should return null for unknown format', () => {
    expect(detectFormat('random binary data')).toBeNull()
  })

  it('should prefer extension over content detection', () => {
    expect(
      detectFormat('Date,Amount\n1,2', 'transactions.qfx')
    ).toBe('qfx')
  })
})

describe('parseStatement', () => {
  it('should parse OFX format', () => {
    const ofx = `OFXHEADER:100
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260701
<TRNAMT>-50
<FITID>TEST001
<NAME>Test Payee
</STMTTRN>
</BANKTRANLIST>
</OFX>`
    const result = parseStatement(ofx, 'ofx', { bankAccountId: 'acct-1' })
    expect(result.transactions).toHaveLength(1)
    expect(result.format).toBe('ofx')
    expect(result.transactions[0].amount).toBe('-50')
  })

  it('should parse CSV format', () => {
    const csv = 'Date,Amount\n2026-07-01,100'
    const result = parseStatement(csv, 'csv', {
      bankAccountId: 'acct-1',
      columnMap: { date: 'Date', amount: 'Amount' },
      dateFormat: 'YYYY-MM-DD',
      amountSignConvention: 'signed',
      currencyDefault: 'USD',
    })
    expect(result.transactions).toHaveLength(1)
    expect(result.format).toBe('csv')
  })

  it('should route QFX to OFX parser', () => {
    const qfx = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260701<TRNAMT>-10<FITID>Q1<NAME>QFX Test</STMTTRN></BANKTRANLIST></OFX>'
    const result = parseStatement(qfx, 'qfx', { bankAccountId: 'acct-1' })
    expect(result.transactions).toHaveLength(1)
  })

  it('should route QBO to OFX parser', () => {
    const qbo = '<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260701<TRNAMT>500<FITID>QB1<NAME>QBO Test</STMTTRN></BANKTRANLIST></OFX>'
    const result = parseStatement(qbo, 'qbo', { bankAccountId: 'acct-1' })
    expect(result.transactions).toHaveLength(1)
  })

  it('should throw for unsupported format', () => {
    expect(() =>
      parseStatement('data', 'xml' as never, { bankAccountId: 'acct-1' })
    ).toThrow('Unsupported format')
  })
})

describe('BANK_IMPORT_FLAG', () => {
  it('should export the feature flag key', () => {
    expect(BANK_IMPORT_FLAG).toBe('bank_import_v1')
  })
})
