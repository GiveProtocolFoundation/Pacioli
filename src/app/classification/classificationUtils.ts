export interface ClassificationRuleMatch {
  id: string
  name: string
  matchTxTypes: string
  matchChains: string
  matchSelfTransfer: string
  sourceKind: string
  matchPayeePattern: string
  matchAmountSign: string
  enabled: boolean
}

/** Finds the first enabled rule matching a crypto transaction's type, chain, and self-transfer status. */
export function findMatchingRule(
  rules: ClassificationRuleMatch[],
  txType: string,
  chainId: string,
  isSelfTransfer: boolean
): ClassificationRuleMatch | undefined {
  return rules.find(rule => {
    if (rule.sourceKind !== 'crypto' && rule.sourceKind !== 'any') return false
    const types = rule.matchTxTypes.split(',').map(s => s.trim())
    const chains = rule.matchChains
      ? rule.matchChains.split(',').map(s => s.trim().toLowerCase())
      : null
    const mode = rule.matchSelfTransfer
    return (
      rule.enabled &&
      types.includes(txType) &&
      (!chains || chains.includes(chainId.toLowerCase())) &&
      (mode !== 'true' || isSelfTransfer) &&
      (mode !== 'false' || !isSelfTransfer)
    )
  })
}

/** Checks whether a pipe-separated payee pattern matches a payee string (case-insensitive). */
export function payeePatternMatches(pattern: string, payee: string): boolean {
  if (!pattern) return true
  const lower = payee.toLowerCase()
  return pattern.split('|').some(sub => sub !== '' && lower.includes(sub.toLowerCase()))
}

/** Finds the first enabled bank rule matching a payee and amount sign. */
export function findMatchingBankRule(
  rules: ClassificationRuleMatch[],
  payee: string,
  isNegative: boolean
): ClassificationRuleMatch | undefined {
  return rules.find(rule => {
    if (!rule.enabled) return false
    if (rule.sourceKind !== 'bank' && rule.sourceKind !== 'any') return false
    if (!payeePatternMatches(rule.matchPayeePattern, payee)) return false
    if (rule.matchAmountSign === 'positive' && isNegative) return false
    if (rule.matchAmountSign === 'negative' && !isNegative) return false
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
