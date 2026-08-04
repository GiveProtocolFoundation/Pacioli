import { parseOfx, detectOfxFormat } from './ofxParser'
import { parseCsv, detectCsvFormat } from './csvParser'
import { dedup, buildExternalIdSet } from './dedup'
import type {
  StatementFormat,
  ParseResult,
  OfxParseOptions,
  CsvParseOptions,
} from './types'

export type { StatementFormat, ParseResult, OfxParseOptions, CsvParseOptions }
export type {
  ParsedTransaction,
  CsvColumnMap,
  AmountSignConvention,
  ParsedAccountInfo,
} from './types'
export { columnMapFromProfile } from './types'
export { inferColumnMap } from './csvParser'
export { dedup, buildExternalIdSet }

/** Detects the statement format from file content and optional filename extension. */
export function detectFormat(
  content: string,
  filename?: string
): StatementFormat | null {
  const ext = filename?.split('.').pop()?.toLowerCase()
  if (ext === 'qfx') return 'qfx'
  if (ext === 'qbo') return 'qbo'
  if (ext === 'ofx') return 'ofx'

  const ofxFormat = detectOfxFormat(content)
  if (ofxFormat) return ofxFormat

  if (ext === 'csv' || detectCsvFormat(content)) return 'csv'

  return null
}

/** Parses a bank statement string into structured transactions using the appropriate format parser. */
export function parseStatement(
  content: string,
  format: StatementFormat,
  options: OfxParseOptions | CsvParseOptions
): ParseResult {
  if (format === 'ofx' || format === 'qfx' || format === 'qbo') {
    return parseOfx(content, options as OfxParseOptions)
  }

  if (format === 'csv') {
    return parseCsv(content, options as CsvParseOptions)
  }

  throw new Error(`Unsupported format: ${format}`)
}

export const BANK_IMPORT_FLAG = 'bank_import_v1'
