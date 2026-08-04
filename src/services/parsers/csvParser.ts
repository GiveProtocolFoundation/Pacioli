import type { CsvParseOptions, ParseResult, ParsedTransaction } from './types'

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

const DATE_FORMATS: Record<string, RegExp> = {
  'YYYY-MM-DD': /^(\d{4})-(\d{1,2})-(\d{1,2})/,
  'MM/DD/YYYY': /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  'DD/MM/YYYY': /^(\d{1,2})\/(\d{1,2})\/(\d{4})/,
  'YYYY/MM/DD': /^(\d{4})\/(\d{1,2})\/(\d{1,2})/,
  'MM-DD-YYYY': /^(\d{1,2})-(\d{1,2})-(\d{4})/,
  'DD-MM-YYYY': /^(\d{1,2})-(\d{1,2})-(\d{4})/,
  'DD.MM.YYYY': /^(\d{1,2})\.(\d{1,2})\.(\d{4})/,
}

function parseDateWithFormat(raw: string, format: string): number {
  const re = DATE_FORMATS[format]
  if (!re) return 0
  const m = re.exec(raw.trim())
  if (!m) return 0

  let year: number, month: number, day: number

  if (format.startsWith('YYYY')) {
    year = Number.parseInt(m[1], 10)
    month = Number.parseInt(m[2], 10) - 1
    day = Number.parseInt(m[3], 10)
  } else if (format.startsWith('MM')) {
    month = Number.parseInt(m[1], 10) - 1
    day = Number.parseInt(m[2], 10)
    year = Number.parseInt(m[3], 10)
  } else {
    day = Number.parseInt(m[1], 10)
    month = Number.parseInt(m[2], 10) - 1
    year = Number.parseInt(m[3], 10)
  }

  return Date.UTC(year, month, day)
}

function parseAmount(raw: string, convention: string, txType?: string): string {
  const cleaned = raw.replace(/[^0-9.\-+]/g, '')
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

function hashString(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    hash = ((hash << 5) - hash + ch) | 0
  }
  return Math.abs(hash).toString(36)
}

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

export function parseCsv(
  content: string,
  options: CsvParseOptions
): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0)
  const skipRows = options.skipHeaderRows ?? 1
  if (lines.length <= skipRows) {
    return {
      transactions: [],
      format: 'csv',
      duplicateCount: 0,
      totalCount: 0,
      currency: options.currencyDefault,
    }
  }

  const headerRowIdx = Math.max(0, skipRows - 1)
  const headers = splitCsvLine(lines[headerRowIdx])
  const colMap = options.columnMap
  const dataLines = lines.slice(skipRows)

  const getColIndex = (colName: string | undefined): number => {
    if (!colName) return -1
    return headers.findIndex(
      h => h.trim().toLowerCase() === colName.trim().toLowerCase()
    )
  }

  const dateIdx = getColIndex(colMap.date)
  const amountIdx = getColIndex(colMap.amount)
  const payeeIdx = getColIndex(colMap.payee)
  const memoIdx = getColIndex(colMap.memo)
  const refIdx = getColIndex(colMap.referenceNumber)
  const typeIdx = getColIndex(colMap.type)
  const balanceIdx = getColIndex(colMap.balance)

  if (dateIdx === -1 || amountIdx === -1) {
    return {
      transactions: [],
      format: 'csv',
      duplicateCount: 0,
      totalCount: 0,
      currency: options.currencyDefault,
    }
  }

  const transactions: ParsedTransaction[] = []
  let duplicateCount = 0

  for (let i = 0; i < dataLines.length; i++) {
    const fields = splitCsvLine(dataLines[i])
    if (fields.length <= Math.max(dateIdx, amountIdx)) continue

    const dateRaw = fields[dateIdx] ?? ''
    const amountRaw = fields[amountIdx] ?? ''
    const typeRaw = typeIdx >= 0 ? fields[typeIdx] : undefined

    const postedDate = parseDateWithFormat(dateRaw, options.dateFormat)
    if (!postedDate) continue

    const amount = parseAmount(amountRaw, options.amountSignConvention, typeRaw)

    const rowData: Record<string, string> = {
      date: dateRaw,
      amount: amountRaw,
      payee: payeeIdx >= 0 ? (fields[payeeIdx] ?? '') : '',
      memo: memoIdx >= 0 ? (fields[memoIdx] ?? '') : '',
    }

    const externalId = computeExternalId(rowData, i + skipRows)
    const isDuplicate = Boolean(options.existingExternalIds?.has(externalId))
    if (isDuplicate) duplicateCount++

    const tx: ParsedTransaction = {
      bank_account_id: options.bankAccountId,
      external_id: externalId,
      posted_date: postedDate,
      amount,
      currency: options.currencyDefault,
      payee: payeeIdx >= 0 ? fields[payeeIdx] || undefined : undefined,
      memo: memoIdx >= 0 ? fields[memoIdx] || undefined : undefined,
      reference_number: refIdx >= 0 ? fields[refIdx] || undefined : undefined,
      tx_type: typeRaw?.toLowerCase() ?? undefined,
      running_balance:
        balanceIdx >= 0 ? fields[balanceIdx] || undefined : undefined,
      classification_status: 'unclassified',
      raw_data: dataLines[i],
      _isDuplicate: isDuplicate,
      _duplicateOf: isDuplicate ? externalId : undefined,
      _rawLine: i + skipRows,
    }

    transactions.push(tx)
  }

  let startDate = Number.POSITIVE_INFINITY
  let endDate = 0
  for (const tx of transactions) {
    if (tx.posted_date < startDate) startDate = tx.posted_date
    if (tx.posted_date > endDate) endDate = tx.posted_date
  }

  return {
    transactions,
    format: 'csv',
    dateRange:
      transactions.length > 0
        ? {
            start: startDate === Number.POSITIVE_INFINITY ? 0 : startDate,
            end: endDate,
          }
        : undefined,
    currency: options.currencyDefault,
    duplicateCount,
    totalCount: transactions.length,
  }
}
