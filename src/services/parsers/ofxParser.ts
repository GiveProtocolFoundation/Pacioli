import type {
  OfxParseOptions,
  ParseResult,
  ParsedAccountInfo,
  ParsedTransaction,
  StatementFormat,
} from './types'

const OFX_DATE_RE = /^(\d{4})(\d{2})(\d{2})(?:(\d{2})(\d{2})(\d{2}))?/

/** Parses an OFX date string (YYYYMMDD[HHmmss]) into a UTC timestamp. */
function parseOfxDate(raw: string): number {
  const match = OFX_DATE_RE.exec(raw.trim())
  if (!match) return 0
  const year = Number.parseInt(match[1], 10)
  const month = Number.parseInt(match[2], 10) - 1
  const day = Number.parseInt(match[3], 10)
  const hour = match[4] ? Number.parseInt(match[4], 10) : 0
  const min = match[5] ? Number.parseInt(match[5], 10) : 0
  const sec = match[6] ? Number.parseInt(match[6], 10) : 0
  return new Date(Date.UTC(year, month, day, hour, min, sec)).getTime()
}

/** Normalizes SGML-style OFX into well-formed XML by closing open value tags. */
function normalizeOfxToXml(raw: string): string {
  const bodyStart = raw.indexOf('<OFX>')
  if (bodyStart === -1) return raw
  let body = raw.slice(bodyStart)

  body = body.replace(
    /<(\w+)[^/>]*>([^<]*)\n/g,
    (_match, tag: string, val: string) => {
      const trimmed = val.trim()
      if (trimmed.length > 0) {
        return `<${tag}>${trimmed}</${tag}>\n`
      }
      return `<${tag}>\n`
    }
  )

  return body
}

/** Escapes special regex characters in a string for safe use in `new RegExp()`. */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Extracts the full content between an opening and closing XML tag. */
function extractTag(xml: string, tag: string): string {
  const escaped = escapeRegExp(tag)
  const openRe = new RegExp(`<${escaped}>`, 'i')
  const closeRe = new RegExp(`</${escaped}>`, 'i')
  const openMatch = openRe.exec(xml)
  if (!openMatch) return ''
  const start = openMatch.index + openMatch[0].length
  const closeMatch = closeRe.exec(xml.slice(start))
  if (!closeMatch) {
    const nl = xml.indexOf('\n', start)
    return nl === -1 ? xml.slice(start).trim() : xml.slice(start, nl).trim()
  }
  return xml.slice(start, start + closeMatch.index).trim()
}

/** Extracts the inline text value immediately following an XML tag. */
function extractTagValue(xml: string, tag: string): string {
  const escaped = escapeRegExp(tag)
  const re = new RegExp(`<${escaped}>\\s*([^<\\n]+)`, 'i')
  const match = re.exec(xml)
  return match ? match[1].trim() : ''
}

/** Finds all content blocks between repeated opening/closing tag pairs. */
function extractAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = []
  const openTag = `<${tag}>`
  const closeTag = `</${tag}>`
  let pos = 0
  while (pos < xml.length) {
    const start = xml.indexOf(openTag, pos)
    if (start === -1) break
    const contentStart = start + openTag.length
    const end = xml.indexOf(closeTag, contentStart)
    if (end === -1) break
    results.push(xml.slice(contentStart, end))
    pos = end + closeTag.length
  }
  return results
}

/** Extracts bank account metadata from the OFX BANKACCTFROM or CCACCTFROM block. */
function parseAccountInfo(xml: string): ParsedAccountInfo {
  const info: ParsedAccountInfo = {}
  const bankAcct =
    extractTag(xml, 'BANKACCTFROM') || extractTag(xml, 'CCACCTFROM')
  if (bankAcct) {
    info.bankId = extractTagValue(bankAcct, 'BANKID')
    info.accountId = extractTagValue(bankAcct, 'ACCTID')
    info.accountType = extractTagValue(bankAcct, 'ACCTTYPE')
  }
  const fi = extractTag(xml, 'FI')
  if (fi) {
    info.institutionName = extractTagValue(fi, 'ORG')
  }
  return info
}

/** Maps an OFX TRNTYPE code to a normalized lowercase transaction type string. */
function mapOfxTxType(ofxType: string): string {
  const map: Record<string, string> = {
    CREDIT: 'credit',
    DEBIT: 'debit',
    INT: 'interest',
    DIV: 'dividend',
    FEE: 'fee',
    SRVCHG: 'service_charge',
    DEP: 'deposit',
    ATM: 'atm',
    POS: 'pos',
    XFER: 'transfer',
    CHECK: 'check',
    PAYMENT: 'payment',
    CASH: 'cash',
    DIRECTDEP: 'direct_deposit',
    DIRECTDEBIT: 'direct_debit',
    REPEATPMT: 'recurring_payment',
    HOLD: 'hold',
    OTHER: 'other',
  }
  return map[ofxType.toUpperCase()] ?? 'other'
}

/** Parses a single OFX STMTTRN block into a ParsedTransaction. */
function parseTransactionBlock(
  block: string,
  options: OfxParseOptions,
  currency: string
): ParsedTransaction {
  const fitid = extractTagValue(block, 'FITID')
  const dtPosted = extractTagValue(block, 'DTPOSTED')
  const dtUser = extractTagValue(block, 'DTUSER')
  const amount = extractTagValue(block, 'TRNAMT')
  const name = extractTagValue(block, 'NAME')
  const memo = extractTagValue(block, 'MEMO')
  const checkNum = extractTagValue(block, 'CHECKNUM')
  const refNum = extractTagValue(block, 'REFNUM')
  const trnType = extractTagValue(block, 'TRNTYPE')

  const isDuplicate = Boolean(fitid && options.existingExternalIds?.has(fitid))

  const tx: ParsedTransaction = {
    bank_account_id: options.bankAccountId,
    external_id: fitid || undefined,
    posted_date: parseOfxDate(dtPosted),
    transaction_date: dtUser ? parseOfxDate(dtUser) : undefined,
    amount,
    currency,
    payee: name || undefined,
    memo: memo || undefined,
    reference_number: checkNum || refNum || undefined,
    tx_type: trnType ? mapOfxTxType(trnType) : undefined,
    classification_status: 'unclassified',
    raw_data: block,
    _isDuplicate: isDuplicate,
    _duplicateOf: isDuplicate ? fitid : undefined,
  }

  return tx
}

/** Detects whether file content is an OFX/QFX/QBO statement by scanning for OFX markers. */
export function detectOfxFormat(content: string): StatementFormat | null {
  const upper = content.slice(0, 2000).toUpperCase()
  if (
    upper.includes('OFXHEADER:') ||
    upper.includes('<OFX>') ||
    upper.includes('<?OFX')
  ) {
    return 'ofx'
  }
  return null
}

/** Parses an OFX/QFX/QBO file into structured transactions and account metadata. */
export function parseOfx(
  content: string,
  options: OfxParseOptions
): ParseResult {
  const xml = normalizeOfxToXml(content)

  const currency =
    extractTagValue(xml, 'CURDEF') || extractTagValue(xml, 'CURRENCY') || 'USD'

  const accountInfo = parseAccountInfo(xml)

  const stmtrs = extractTag(xml, 'STMTTRNRS') || extractTag(xml, 'CCSTMTTRNRS')

  const tranList = stmtrs
    ? extractTag(stmtrs, 'BANKTRANLIST')
    : extractTag(xml, 'BANKTRANLIST')

  const txBlocks = extractAllBlocks(tranList || stmtrs || xml, 'STMTTRN')

  const transactions: ParsedTransaction[] = txBlocks.map(block =>
    parseTransactionBlock(block, options, currency)
  )

  let startDate = 0
  let endDate = 0
  if (tranList) {
    const dtStart = extractTagValue(tranList, 'DTSTART')
    const dtEnd = extractTagValue(tranList, 'DTEND')
    if (dtStart) startDate = parseOfxDate(dtStart)
    if (dtEnd) endDate = parseOfxDate(dtEnd)
  }

  const duplicateCount = transactions.filter(t => t._isDuplicate).length

  return {
    transactions,
    format: 'ofx',
    accountInfo,
    dateRange:
      startDate || endDate ? { start: startDate, end: endDate } : undefined,
    currency,
    duplicateCount,
    totalCount: transactions.length,
  }
}
