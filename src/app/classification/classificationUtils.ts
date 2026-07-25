export interface ClassificationRuleMatch {
  id: string
  name: string
  matchTxTypes: string
  matchChains: string
  matchSelfTransfer: string
  enabled: boolean
}

/** Finds the first enabled rule matching a transaction's type and chain. */
export function findMatchingRule(
  rules: ClassificationRuleMatch[],
  txType: string,
  chainId: string
): ClassificationRuleMatch | undefined {
  return rules.find(rule => {
    if (!rule.enabled) return false
    const types = rule.matchTxTypes.split(',').map(s => s.trim())
    if (!types.includes(txType)) return false
    if (rule.matchChains) {
      const chains = rule.matchChains.split(',').map(s => s.trim().toLowerCase())
      if (!chains.includes(chainId.toLowerCase())) return false
    }
    return true
  })
}

/** Formats a Unix timestamp to a localized date string. */
export function formatTimestamp(timestampSecs: number): string {
  return new Date(timestampSecs * 1000).toLocaleDateString()
}

/** Formats a Unix timestamp to a localized date+time string. */
export function formatTimestampFull(timestampSecs: number): string {
  return new Date(timestampSecs * 1000).toLocaleString()
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

const ruleDescriptions: Record<string, string> = {
  claim: 'Staking reward → DR Crypto Assets / CR Staking Income',
  stake: 'Staking reward → DR Crypto Assets / CR Staking Income',
  transfer: 'Transfer → self-transfer detection or external income',
  swap: 'Token swap → DR new asset / CR disposed asset',
  bridge: 'Bridge transfer → inter-chain rebalance',
  unstake: 'Unstake → return of staked principal',
  mint: 'Mint → DR Crypto Assets / CR Income',
  burn: 'Burn → DR Expense / CR Crypto Assets',
  approve: 'Contract approval → fee-only entry',
  contract_call: 'Contract interaction → fee-only entry',
}

/** @returns Short description of the classification heuristic for a given tx type. */
export function rulePreview(txType: string): string {
  return ruleDescriptions[txType] ?? 'Heuristic classification based on tx type'
}
