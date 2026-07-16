/** Formats a Unix timestamp to a localized date string. */
export function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString()
}

/** Formats a Unix timestamp to a localized date+time string. */
export function formatTimestampFull(ts: number): string {
  return new Date(ts * 1000).toLocaleString()
}

/** Truncates a hex hash to a short display form (first 8 + last 4 chars). */
export function truncateHash(hash: string): string {
  if (hash.length <= 14) return hash
  return `${hash.slice(0, 8)}...${hash.slice(-4)}`
}

/** Human-readable labels for raw tx_type values. */
export const txTypeLabels: Record<string, string> = {
  transfer: 'Transfer',
  swap: 'Swap',
  bridge: 'Bridge',
  stake: 'Stake',
  unstake: 'Unstake',
  claim: 'Claim',
  mint: 'Mint',
  burn: 'Burn',
  approve: 'Approve',
  contract_call: 'Contract Call',
  unknown: 'Unknown',
}

/** Returns a human-readable label for a tx_type. */
export function displayTxType(txType: string): string {
  return txTypeLabels[txType] ?? txType
}
