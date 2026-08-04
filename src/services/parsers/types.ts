import type {
  BankTransactionInput,
  StatementProfile,
} from '../persistence/types'

export type StatementFormat = 'ofx' | 'qfx' | 'qbo' | 'csv'

export type AmountSignConvention =
  | 'signed'
  | 'debit_positive'
  | 'debit_negative'

export interface ParsedTransaction extends BankTransactionInput {
  _isDuplicate?: boolean
  _duplicateOf?: string
  _rawLine?: number
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  format: StatementFormat
  accountInfo?: ParsedAccountInfo
  dateRange?: { start: number; end: number }
  currency?: string
  duplicateCount: number
  totalCount: number
}

export interface ParsedAccountInfo {
  bankId?: string
  accountId?: string
  accountType?: string
  institutionName?: string
}

export interface CsvColumnMap {
  date: string
  amount: string
  payee?: string
  memo?: string
  referenceNumber?: string
  type?: string
  balance?: string
}

export interface CsvParseOptions {
  bankAccountId: string
  columnMap: CsvColumnMap
  dateFormat: string
  amountSignConvention: AmountSignConvention
  currencyDefault: string
  skipHeaderRows?: number
  existingExternalIds?: Set<string>
}

export interface OfxParseOptions {
  bankAccountId: string
  existingExternalIds?: Set<string>
}

export interface StatementParser {
  parse(
    content: string,
    options: OfxParseOptions | CsvParseOptions
  ): ParseResult
  detectFormat(content: string): StatementFormat | null
}

/** Deserializes a StatementProfile's JSON column_map into a typed CsvColumnMap, or null on failure. */
export function columnMapFromProfile(
  profile: StatementProfile
): CsvColumnMap | null {
  if (!profile.column_map) return null
  try {
    return JSON.parse(profile.column_map) as CsvColumnMap
  } catch {
    return null
  }
}
