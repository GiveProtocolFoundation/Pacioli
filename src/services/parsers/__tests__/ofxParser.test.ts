import { describe, it, expect } from 'vitest'
import { parseOfx, detectOfxFormat } from '../ofxParser'
import type { OfxParseOptions } from '../types'

const OFX_V1_SAMPLE = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252
COMPRESSION:NONE
OLDFILEUID:NONE
NEWFILEUID:NONE

<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<DTSERVER>20260715120000
<LANGUAGE>ENG
<FI>
<ORG>Test Bank
<FID>12345
</FI>
</SONRS>
</SIGNONMSGSRSV1>
<BANKMSGSRSV1>
<STMTTRNRS>
<TRNUID>1001
<STATUS>
<CODE>0
<SEVERITY>INFO
</STATUS>
<STMTRS>
<CURDEF>USD
<BANKACCTFROM>
<BANKID>071000013
<ACCTID>123456789
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701
<DTEND>20260715
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260702
<TRNAMT>-45.50
<FITID>20260702001
<NAME>GROCERY STORE
<MEMO>Purchase at grocery
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260705
<TRNAMT>2500.00
<FITID>20260705001
<NAME>EMPLOYER INC
<MEMO>Direct deposit payroll
</STMTTRN>
<STMTTRN>
<TRNTYPE>CHECK
<DTPOSTED>20260710
<TRNAMT>-150.00
<FITID>20260710001
<NAME>LANDLORD
<CHECKNUM>1042
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>5234.50
<DTASOF>20260715
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`

const OFX_V2_XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<OFX>
<SIGNONMSGSRSV1>
<SONRS>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<DTSERVER>20260715120000</DTSERVER>
<LANGUAGE>ENG</LANGUAGE>
</SONRS>
</SIGNONMSGSRSV1>
<CREDITCARDMSGSRSV1>
<CCSTMTTRNRS>
<TRNUID>2001</TRNUID>
<STATUS><CODE>0</CODE><SEVERITY>INFO</SEVERITY></STATUS>
<CCSTMTRS>
<CURDEF>EUR</CURDEF>
<CCACCTFROM>
<ACCTID>4111111111111111</ACCTID>
</CCACCTFROM>
<BANKTRANLIST>
<DTSTART>20260701</DTSTART>
<DTEND>20260715</DTEND>
<STMTTRN>
<TRNTYPE>DEBIT</TRNTYPE>
<DTPOSTED>20260703120000</DTPOSTED>
<TRNAMT>-29.99</TRNAMT>
<FITID>CC20260703001</FITID>
<NAME>STREAMING SERVICE</NAME>
<MEMO>Monthly subscription</MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>PAYMENT</TRNTYPE>
<DTPOSTED>20260710</DTPOSTED>
<TRNAMT>500.00</TRNAMT>
<FITID>CC20260710001</FITID>
<NAME>PAYMENT RECEIVED</NAME>
</STMTTRN>
</BANKTRANLIST>
</CCSTMTRS>
</CCSTMTTRNRS>
</CREDITCARDMSGSRSV1>
</OFX>`

const defaultOptions: OfxParseOptions = {
  bankAccountId: 'test-bank-acct-1',
}

describe('detectOfxFormat', () => {
  it('should detect OFX v1 by header', () => {
    expect(detectOfxFormat(OFX_V1_SAMPLE)).toBe('ofx')
  })

  it('should detect OFX v2 by XML processing instruction', () => {
    expect(detectOfxFormat(OFX_V2_XML)).toBe('ofx')
  })

  it('should return null for non-OFX content', () => {
    expect(
      detectOfxFormat('Date,Amount,Description\n2026-07-01,100,Test')
    ).toBeNull()
  })

  it('should detect by <OFX> tag alone', () => {
    expect(detectOfxFormat('some preamble\n<OFX>\n')).toBe('ofx')
  })
})

describe('parseOfx', () => {
  describe('OFX v1 (SGML)', () => {
    it('should parse all 3 transactions', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      expect(result.transactions).toHaveLength(3)
      expect(result.format).toBe('ofx')
      expect(result.totalCount).toBe(3)
    })

    it('should extract currency', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      expect(result.currency).toBe('USD')
    })

    it('should extract account info', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      expect(result.accountInfo?.bankId).toBe('071000013')
      expect(result.accountInfo?.accountId).toBe('123456789')
      expect(result.accountInfo?.accountType).toBe('CHECKING')
      expect(result.accountInfo?.institutionName).toBe('Test Bank')
    })

    it('should extract date range', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      expect(result.dateRange).toBeDefined()
      if (!result.dateRange) return
      const startDate = new Date(result.dateRange.start)
      expect(startDate.getUTCFullYear()).toBe(2026)
      expect(startDate.getUTCMonth()).toBe(6)
      expect(startDate.getUTCDate()).toBe(1)
    })

    it('should parse debit transaction correctly', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      const debit = result.transactions[0]
      expect(debit.amount).toBe('-45.50')
      expect(debit.external_id).toBe('20260702001')
      expect(debit.payee).toBe('GROCERY STORE')
      expect(debit.memo).toBe('Purchase at grocery')
      expect(debit.tx_type).toBe('debit')
      expect(debit.bank_account_id).toBe('test-bank-acct-1')
    })

    it('should parse credit transaction correctly', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      const credit = result.transactions[1]
      expect(credit.amount).toBe('2500.00')
      expect(credit.external_id).toBe('20260705001')
      expect(credit.payee).toBe('EMPLOYER INC')
      expect(credit.tx_type).toBe('credit')
    })

    it('should parse check with CHECKNUM', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      const check = result.transactions[2]
      expect(check.amount).toBe('-150.00')
      expect(check.reference_number).toBe('1042')
      expect(check.tx_type).toBe('check')
    })

    it('should parse dates as UTC timestamps', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      const tx = result.transactions[0]
      const date = new Date(tx.posted_date)
      expect(date.getUTCFullYear()).toBe(2026)
      expect(date.getUTCMonth()).toBe(6)
      expect(date.getUTCDate()).toBe(2)
    })

    it('should set classification_status to unclassified', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      for (const tx of result.transactions) {
        expect(tx.classification_status).toBe('unclassified')
      }
    })
  })

  describe('OFX v2 (XML)', () => {
    it('should parse credit card statement', () => {
      const result = parseOfx(OFX_V2_XML, defaultOptions)
      expect(result.transactions).toHaveLength(2)
      expect(result.currency).toBe('EUR')
    })

    it('should extract CC account info', () => {
      const result = parseOfx(OFX_V2_XML, defaultOptions)
      expect(result.accountInfo?.accountId).toBe('4111111111111111')
    })

    it('should parse datetime with hours/minutes/seconds', () => {
      const result = parseOfx(OFX_V2_XML, defaultOptions)
      const tx = result.transactions[0]
      const date = new Date(tx.posted_date)
      expect(date.getUTCHours()).toBe(12)
    })
  })

  describe('dedup', () => {
    it('should mark known FITIDs as duplicates', () => {
      const opts: OfxParseOptions = {
        bankAccountId: 'test-bank-acct-1',
        existingExternalIds: new Set(['20260702001', '20260710001']),
      }
      const result = parseOfx(OFX_V1_SAMPLE, opts)
      expect(result.duplicateCount).toBe(2)

      const dupes = result.transactions.filter(t => t._isDuplicate)
      expect(dupes).toHaveLength(2)
      expect(dupes[0].external_id).toBe('20260702001')
      expect(dupes[1].external_id).toBe('20260710001')
    })

    it('should not mark unknown FITIDs as duplicates', () => {
      const opts: OfxParseOptions = {
        bankAccountId: 'test-bank-acct-1',
        existingExternalIds: new Set(['nonexistent']),
      }
      const result = parseOfx(OFX_V1_SAMPLE, opts)
      expect(result.duplicateCount).toBe(0)
    })

    it('should report zero duplicates with no existing IDs', () => {
      const result = parseOfx(OFX_V1_SAMPLE, defaultOptions)
      expect(result.duplicateCount).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const result = parseOfx('', defaultOptions)
      expect(result.transactions).toHaveLength(0)
      expect(result.totalCount).toBe(0)
    })

    it('should handle OFX with no transactions', () => {
      const noTx = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>USD
<BANKTRANLIST>
<DTSTART>20260701
<DTEND>20260715
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`
      const result = parseOfx(noTx, defaultOptions)
      expect(result.transactions).toHaveLength(0)
      expect(result.currency).toBe('USD')
    })

    it('should map all known OFX transaction types', () => {
      const types = [
        'CREDIT',
        'DEBIT',
        'INT',
        'DIV',
        'FEE',
        'SRVCHG',
        'DEP',
        'ATM',
        'POS',
        'XFER',
        'CHECK',
        'PAYMENT',
        'CASH',
        'DIRECTDEP',
        'DIRECTDEBIT',
        'REPEATPMT',
        'HOLD',
        'OTHER',
      ]
      for (const t of types) {
        const ofx = `<OFX><BANKTRANLIST><STMTTRN><TRNTYPE>${t}<DTPOSTED>20260701<TRNAMT>100<FITID>test_${t}<NAME>Test</STMTTRN></BANKTRANLIST></OFX>`
        const result = parseOfx(ofx, defaultOptions)
        expect(result.transactions).toHaveLength(1)
        expect(result.transactions[0].tx_type).toBeTruthy()
      }
    })
  })
})
