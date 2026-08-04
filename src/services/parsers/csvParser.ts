import type {
  CsvColumnMap,
  CsvParseOptions,
  ParseResult,
  ParsedTransaction,
} from './types'

/** Splits a CSV line into fields, respecting quoted values. */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// Shared regex for MM/DD and DD/MM — groups are positional; parseDateWithFormat resolves semantics via the format key.
const SLASH_DMY_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
const DASH_DMY_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})/

const DATE_FORMATS: Record<string, RegExp> = {
  'YYYY-MM-DD': /^(\d{4})-(\d{1,2})-(\d{1,2})/,
  'MM/DD/YYYY': SLASH_DMY_RE,
  'DD/MM/YYYY': SLASH_DMY_RE,
  'YYYY/MM/DD': /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  'MM-DD-YYYY': DASH_DMY_RE,
  'DD-MM-YYYY': DASH_DMY_RE,
  'DD.MM.YYYY': /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
}

/** Parses a date string using the given format key and returns a UTC timestamp. */
function parseDateWithFormat(raw: string, format: string): number {
  const re = DATE_FORMATS[format]
  if (!re) return 0
  const match = re.exec(raw.trim())
  if (!match) return 0

  let year: number, month: number, day: number

  if (format.startsWith('YYYY')) {
    year = Number.parseInt(match[1], 10)
    month = Number.parseInt(match[2], 10) - 1
    day = Number.parseInt(match[3], 10)
  } else if (format.startsWith('MM')) {
    month = Number.parseInt(match[1], 10) - 1
    day = Number.parseInt(match[2], 10)
    year = Number.parseInt(match[3], 10)
  } else {
    day = Number.parseInt(match[1], 10)
    month = Number.parseInt(match[2], 10) - 1
    year = Number.parseInt(match[3], 10)
  }

  return Date.UTC(year, month, day)
}

/** Strips non-numeric characters and applies the sign convention to produce a numeric string. */
function parseAmount(raw: string, convention: string, txType?: string): string {
  const cleaned = raw.replace(/[^0-9.+-]/g, '')
  if (!cleaned) return '0'

  const num = Number.parseFloat(cleaned)
  if (Number.isNaN(num)) return '0'

  if (convention === 'signed') {
    return num.toString()
  }

  if (convention === 'debit_positive') {
    const isDebit =
      txType?.toLowerCase().includes('debit') ||
      txType?.toLowerCase().includes('withdrawal') ||
      txType?.toLowerCase().includes('payment')
    return isDebit ? (-Math.abs(num)).toString() : Math.abs(num).toString()
  }

  if (convention === 'debit_negative') {
    return num.toString()
  }

  return num.toString()
}

/** Computes a deterministic external ID from row values and line number. */
function computeExternalId(
  row: Record<string, string>,
  lineNum: number
): string {
  const parts = [
    row.date ?? '',
    row.amount ?? '',
    row.payee ?? row.memo ?? '',
    String(lineNum),
  ]
  return `csv_${hashString(parts.join('|'))}`
}

/** Produces a simple numeric hash of a string, returned in base-36. */
function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash).toString(36)
}

/** Checks whether file content looks like a bank-statement CSV based on header keywords. */
export function detectCsvFormat(content: string): boolean {
  const lines = content.split('\n').filter(l => l.trim().length > 0)
  if (lines.length < 2) return false

  const firstLine = lines[0]
  const commaCount = (firstLine.match(/,/g) ?? []).length
  if (commaCount < 1) return false

  const headerLower = firstLine.toLowerCase()
  const bankKeywords = [
    'date',
    'amount',
    'description',
    'memo',
    'payee',
    'debit',
    'credit',
    'balance',
    'transaction',
    'reference',
    'check',
  ]
  return bankKeywords.some(kw => headerLower.includes(kw))
}

/** Maps common bank-statement header names to semantic column roles. */
export function inferColumnMap(
  headers: string[]
): Partial<Record<string, string>> {
  const map: Record<string, string> = {}
  const lower = headers.map(h => h.toLowerCase().trim())

  const datePatterns = [
    'date',
    'posted date',
    'transaction date',
    'posting date',
    'trans date',
  ]
  const amountPatterns = ['amount', 'debit', 'credit', 'value', 'sum']
  const payeePatterns = [
    'payee',
    'description',
    'name',
    'merchant',
    'vendor',
    'details',
  ]
  const memoPatterns = ['memo', 'note', 'notes', 'additional info']
  const refPatterns = [
    'reference',
    'ref',
    'check',
    'check number',
    'confirmation',
    'id',
  ]
  const typePatterns = ['type', 'transaction type', 'category', 'trans type']
  const balancePatterns = ['balance', 'running balance', 'ending balance']

  for (const patterns of [
    { key: 'date', list: datePatterns },
    { key: 'amount', list: amountPatterns },
    { key: 'payee', list: payeePatterns },
    { key: 'memo', list: memoPatterns },
    { key: 'referenceNumber', list: refPatterns },
    { key: 'type', list: typePatterns },
    { key: 'balance', list: balancePatterns },
  ]) {
    for (const pattern of patterns.list) {
      const idx = lower.indexOf(pattern)
      if (idx !== -1 && !map[patterns.key]) {
        map[patterns.key] = headers[idx]
        break
      }
    }
  }

  return map
}

interface ColumnIndices {
  date: number
  amount: number
  payee: number
  memo: number
  ref: number
  type: number
  balance: number
}

/** Resolves column indices from header names using case-insensitive matching. */
function resolveColumns(
  headers: string[],
  colMap: CsvColumnMap
): ColumnIndices {
  const resolve = (colName: string | undefined): number => {
    if (!colName) return -1
    return headers.findIndex(
      h => h.trim().toLowerCase() === colName.trim().toLowerCase()
    )
  }
  return {
    date: resolve(colMap.date),
    amount: resolve(colMap.amount),
    payee: resolve(colMap.payee),
    memo: resolve(colMap.memo),
    ref: resolve(colMap.referenceNumber),
    type: resolve(colMap.type),
    balance: resolve(colMap.balance),
  }
}

/** Returns the field at the given index, or undefined if the index is negative or the field is empty. */
function optionalField(fields: string[], idx: number): string | undefined {
  if (idx < 0) return undefined
  return fields[idx] || undefined
}

/** Parses a single CSV data row into a ParsedTransaction, or null if the row is invalid. */
function parseCsvRow(
  rawLine: string,
  fields: string[],
  lineNum: number,
  cols: ColumnIndices,
  options: CsvParseOptions
): ParsedTransaction | null {
  if (fields.length <= Math.max(cols.date, cols.amount)) return null

  const dateRaw = fields[cols.date] ?? ''
  const amountRaw = fields[cols.amount] ?? ''
  const typeRaw = optionalField(fields, cols.type)

  const postedDate = parseDateWithFormat(dateRaw, options.dateFormat)
  if (!postedDate) return null

  const amount = parseAmount(amountRaw, options.amountSignConvention, typeRaw)

  const rowData: Record<string, string> = {
    date: dateRaw,
    amount: amountRaw,
    payee: cols.payee >= 0 ? (fields[cols.payee] ?? '') : '',
    memo: cols.memo >= 0 ? (fields[cols.memo] ?? '') : '',
  }

  const externalId = computeExternalId(rowData, lineNum)
  const isDuplicate = Boolean(options.existingExternalIds?.has(externalId))

  return {
    bank_account_id: options.bankAccountId,
    external_id: externalId,
    posted_date: postedDate,
    amount,
    currency: options.currencyDefault,
    payee: optionalField(fields, cols.payee),
    memo: optionalField(fields, cols.memo),
    reference_number: optionalField(fields, cols.ref),
    tx_type: typeRaw?.toLowerCase() ?? undefined,
    running_balance: optionalField(fields, cols.balance),
    classification_status: 'unclassified',
    raw_data: rawLine,
    _isDuplicate: isDuplicate,
    _duplicateOf: isDuplicate ? externalId : undefined,
    _rawLine: lineNum,
  }
}

/** Computes the earliest and latest posted_date across a transaction list. */
function computeDateRange(
  transactions: ParsedTransaction[]
): { start: number; end: number } | undefined {
  if (transactions.length === 0) return undefined
  let start = Number.POSITIVE_INFINITY
  let end = 0
  for (const tx of transactions) {
    if (tx.posted_date < start) start = tx.posted_date
    if (tx.posted_date > end) end = tx.posted_date
  }
  return {
    start: start === Number.POSITIVE_INFINITY ? 0 : start,
    end,
  }
}

/** Parses a CSV bank statement into structured transactions. */
export function parseCsv(
  content: string,
  options: CsvParseOptions
): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const skipRows = options.skipHeaderRows ?? 1
  const emptyResult: ParseResult = {
    transactions: [],
    format: 'csv',
    duplicateCount: 0,
    totalCount: 0,
    currency: options.currencyDefault,
  }

  if (lines.length <= skipRows) return emptyResult

  const headerRowIdx = Math.max(0, skipRows - 1)
  const headers = splitCsvLine(lines[headerRowIdx])
  const cols = resolveColumns(headers, options.columnMap)
  const dataLines = lines.slice(skipRows)

  if (cols.date === -1 || cols.amount === -1) return emptyResult

  const transactions: ParsedTransaction[] = []
  let duplicateCount = 0

  for (let i = 0; i < dataLines.length; i++) {
    const fields = splitCsvLine(dataLines[i])
    const tx = parseCsvRow(dataLines[i], fields, i + skipRows, cols, options)
    if (!tx) continue
    if (tx._isDuplicate) duplicateCount++
    transactions.push(tx)
  }

  return {
    transactions,
    format: 'csv',
    dateRange: computeDateRange(transactions),
    currency: options.currencyDefault,
    duplicateCount,
    totalCount: transactions.length,
  }
}
