import type { BankTransaction } from '../persistence/types'
import type { ParsedTransaction } from './types'

export interface DedupResult {
  unique: ParsedTransaction[]
  duplicates: ParsedTransaction[]
  duplicateCount: number
}

export function dedup(
  parsed: ParsedTransaction[],
  existing: BankTransaction[]
): DedupResult {
  const existingKeys = new Set<string>()
  for (const tx of existing) {
    if (tx.external_id) {
      existingKeys.add(`${tx.bank_account_id}_${tx.external_id}`)
    }
  }

  const batchKeys = new Set<string>()
  const unique: ParsedTransaction[] = []
  const duplicates: ParsedTransaction[] = []

  for (const tx of parsed) {
    const key = tx.external_id
      ? `${tx.bank_account_id}_${tx.external_id}`
      : null

    if (key && (existingKeys.has(key) || batchKeys.has(key))) {
      duplicates.push({
        ...tx,
        _isDuplicate: true,
        _duplicateOf: tx.external_id,
      })
    } else {
      if (key) batchKeys.add(key)
      unique.push({ ...tx, _isDuplicate: false })
    }
  }

  return { unique, duplicates, duplicateCount: duplicates.length }
}

export function buildExternalIdSet(
  existing: BankTransaction[]
): Set<string> {
  const ids = new Set<string>()
  for (const tx of existing) {
    if (tx.external_id) {
      ids.add(tx.external_id)
    }
  }
  return ids
}
