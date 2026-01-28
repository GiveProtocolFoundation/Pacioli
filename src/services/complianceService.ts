/**
 * Compliance Service
 * Handles US GAAP and IFRS accounting treatments for crypto assets
 */

import Decimal from 'decimal.js'
import {
  AccountingStandard,
  AssetClassification,
  CryptoHolding,
  ComplianceSettings,
  DisclosureReport,
  GAAPIFRSReconciliation,
} from '../types/cryptoAccounting'

export interface MeasurementResult {
  carryingAmount: string
  fairValue: string
  unrealizedGainLoss: string
  impairmentLoss?: string
  measurementBasis: string
}

export interface JournalEntry {
  date: string
  debitAccount: string
  creditAccount: string
  amount: string
  description: string
  standard: AccountingStandard
}

/**
 * Compliance Service
 */
export class ComplianceService {
  private settings: ComplianceSettings | null = null

  /**
   * Initialize compliance service with settings
   */
  initialize(settings: ComplianceSettings): void {
    this.settings = settings
  }

  /**
   * Determine measurement basis for a holding based on classification and standard
   */
  getMeasurementBasis(
    classification: AssetClassification,
    standard: AccountingStandard
  ): MeasurementResult['measurementBasis'] {
    // Broker-Trader: Always fair value through P&L for both standards
    if (classification === 'BrokerTrader') {
      return 'Fair Value through P&L'
    }

    // For US GAAP
    if (standard === 'US_GAAP' || standard === 'Both') {
      switch (classification) {
        case 'Investment':
          return 'Fair Value through P&L' // US GAAP requires FV for crypto
        case 'Operational':
          return 'Fair Value through P&L' // Intangible asset measured at FV
        case 'Inventory':
          return 'Lower of Cost or NRV' // Inventory rules
        default:
          return 'Fair Value through P&L'
      }
    }

    // For IFRS
    if (standard === 'IFRS') {
      const measurementModel =
        this.settings?.ifrsMeasurementModel || 'CostModel'

      switch (classification) {
        case 'Investment':
          return measurementModel === 'RevaluationModel'
            ? 'Revaluation Model'
            : 'Cost less Impairment'
        case 'Operational':
          return 'Cost less Impairment' // IAS 38 Intangible Assets
        case 'Inventory':
          return 'Lower of Cost or NRV' // IAS 2 Inventories
        default:
          return 'Cost less Impairment'
      }
    }

    return 'Fair Value through P&L'
  }

  /**
   * Calculate carrying amount based on standard and classification
   */
  calculateMeasurement(
    holding: CryptoHolding,
    classification: AssetClassification
  ): MeasurementResult {
    if (!this.settings) {
      throw new Error('Compliance settings not initialized')
    }

    const standard = this.settings.accountingStandard
    const measurementBasis = this.getMeasurementBasis(classification, standard)
    const fairValue = new Decimal(holding.currentFairValue)

    // Get cost basis (using selected method)
    // Note: SpecificID requires lot-level tracking, falls back to FIFO for holding-level
    const costBasisMethod =
      this.settings.defaultCostBasisMethod === 'SpecificID'
        ? 'FIFO'
        : this.settings.defaultCostBasisMethod
    const costBasis = new Decimal(holding.costBasis[costBasisMethod])

    let carryingAmount: Decimal
    let unrealizedGainLoss: Decimal
    let impairmentLoss: string | undefined

    switch (measurementBasis) {
      case 'Fair Value through P&L':
      case 'Revaluation Model': {
        // Carrying amount = Fair value
        carryingAmount = fairValue
        unrealizedGainLoss = fairValue.minus(costBasis)
        break
      }

      case 'Cost less Impairment': {
        // IFRS cost model
        const totalImpairment = new Decimal(holding.totalImpairment || '0')
        carryingAmount = costBasis.minus(totalImpairment)

        // Check if additional impairment needed
        if (fairValue.lt(carryingAmount)) {
          const additionalImpairment = carryingAmount.minus(fairValue)
          impairmentLoss = additionalImpairment.toString()
          carryingAmount = fairValue
        }

        unrealizedGainLoss = carryingAmount.minus(costBasis)
        break
      }

      case 'Lower of Cost or NRV': {
        // Inventory: Lower of cost or net realizable value
        carryingAmount = Decimal.min(costBasis, fairValue)
        unrealizedGainLoss = carryingAmount.minus(costBasis)

        if (carryingAmount.lt(costBasis)) {
          impairmentLoss = costBasis.minus(carryingAmount).toString()
        }
        break
      }

      default:
        carryingAmount = fairValue
        unrealizedGainLoss = fairValue.minus(costBasis)
    }

    return {
      carryingAmount: carryingAmount.toString(),
      fairValue: fairValue.toString(),
      unrealizedGainLoss: unrealizedGainLoss.toString(),
      impairmentLoss,
      measurementBasis,
    }
  }

  /**
   * Generate journal entries for crypto transactions
   */
  generateJournalEntries(
    holding: CryptoHolding,
    classification: AssetClassification,
    transaction: 'acquisition' | 'revaluation' | 'impairment' | 'disposal'
  ): JournalEntry[] {
    if (!this.settings) {
      throw new Error('Compliance settings not initialized')
    }

    const entries: JournalEntry[] = []
    const standard = this.settings.accountingStandard
    const today = new Date().toISOString()

    switch (transaction) {
      case 'acquisition': {
        // Dr: Crypto Asset
        // Cr: Cash/Bank
        const costBasisMethod =
          this.settings.defaultCostBasisMethod === 'SpecificID'
            ? 'FIFO'
            : this.settings.defaultCostBasisMethod
        entries.push({
          date: today,
          debitAccount: `Crypto Assets - ${holding.assetSymbol}`,
          creditAccount: 'Cash',
          amount: holding.costBasis[costBasisMethod],
          description: `Acquisition of ${holding.totalQuantity} ${holding.assetSymbol}`,
          standard,
        })
        break
      }

      case 'revaluation': {
        const measurement = this.calculateMeasurement(holding, classification)
        const gainLoss = new Decimal(measurement.unrealizedGainLoss)

        if (gainLoss.eq(0)) break

        if (gainLoss.gt(0)) {
          // Unrealized gain
          entries.push({
            date: today,
            debitAccount: `Crypto Assets - ${holding.assetSymbol}`,
            creditAccount:
              standard === 'IFRS' &&
              this.settings.ifrsMeasurementModel === 'RevaluationModel'
                ? 'Revaluation Surplus (OCI)'
                : 'Unrealized Gain on Crypto Assets',
            amount: gainLoss.abs().toString(),
            description: `Revaluation of ${holding.assetSymbol} to fair value`,
            standard,
          })
        } else {
          // Unrealized loss
          entries.push({
            date: today,
            debitAccount: 'Unrealized Loss on Crypto Assets',
            creditAccount: `Crypto Assets - ${holding.assetSymbol}`,
            amount: gainLoss.abs().toString(),
            description: `Revaluation of ${holding.assetSymbol} to fair value`,
            standard,
          })
        }
        break
      }

      case 'impairment': {
        const measurement = this.calculateMeasurement(holding, classification)
        if (!measurement.impairmentLoss) break

        entries.push({
          date: today,
          debitAccount: 'Impairment Loss',
          creditAccount: `Crypto Assets - ${holding.assetSymbol}`,
          amount: measurement.impairmentLoss,
          description: `Impairment of ${holding.assetSymbol}`,
          standard,
        })
        break
      }

      case 'disposal': {
        // This would require disposal details
        // Placeholder for disposal journal entries
        break
      }

      default:
        // No journal entries needed for unknown transaction types
        break
    }

    return entries
  }

  /**
   * Check if impairment test is required
   */
  requiresImpairmentTest(
    classification: AssetClassification,
    standard: AccountingStandard
  ): boolean {
    if (standard === 'US_GAAP') {
      // US GAAP: Impairment test for certain intangible assets
      return classification === 'Operational'
    }

    if (standard === 'IFRS') {
      const model = this.settings?.ifrsMeasurementModel || 'CostModel'
      // IFRS: Impairment test required for cost model
      return model === 'CostModel'
    }

    return false
  }

  /**
   * Perform impairment test
   */
  performImpairmentTest(
    carryingAmount: string,
    fairValue: string,
    previousImpairment = '0'
  ): { isImpaired: boolean; impairmentLoss: string; allowReversal: boolean } {
    if (!this.settings) {
      throw new Error('Compliance settings not initialized')
    }

    const carrying = new Decimal(carryingAmount)
    const fair = new Decimal(fairValue)
    const previous = new Decimal(previousImpairment)

    const standard = this.settings.accountingStandard
    let isImpaired = false
    let impairmentLoss = new Decimal(0)
    let allowReversal = false

    // Check if fair value is below carrying amount
    if (fair.lt(carrying)) {
      isImpaired = true
      impairmentLoss = carrying.minus(fair)
    }

    // IFRS allows impairment reversal, US GAAP does not
    if (standard === 'IFRS' || standard === 'Both') {
      allowReversal = this.settings.allowImpairmentReversal ?? true

      // Check for reversal: fair value increased above carrying amount
      if (previous.gt(0) && fair.gt(carrying)) {
        const potentialReversal = fair.minus(carrying)
        const maxReversal = previous // Cannot reverse more than previously impaired
        const reversalAmount = Decimal.min(potentialReversal, maxReversal)

        // Negative impairment indicates reversal
        impairmentLoss = reversalAmount.neg()
      }
    }

    return {
      isImpaired,
      impairmentLoss: impairmentLoss.toString(),
      allowReversal,
    }
  }

  /**
   * Generate GAAP/IFRS reconciliation
   */
  generateReconciliation(
    holdings: CryptoHolding[],
    reportDate: string
  ): GAAPIFRSReconciliation {
    // Calculate total carrying amounts under each standard
    const gaapTotal = this.calculateTotalCarrying(holdings, 'US_GAAP')
    const ifrsTotal = this.calculateTotalCarrying(holdings, 'IFRS')

    const adjustments: GAAPIFRSReconciliation['adjustments'] = []
    const keyDifferences: GAAPIFRSReconciliation['keyDifferences'] = []

    // Identify differences
    for (const holding of holdings) {
      const gaapMeasurement = this.calculateMeasurement(
        holding,
        holding.classificationBreakdown.Investment
          ? 'Investment'
          : 'BrokerTrader'
      )
      // For IFRS, temporarily change settings
      const originalStandard = this.settings?.accountingStandard
      if (this.settings) {
        this.settings.accountingStandard = 'IFRS'
      }
      const ifrsMeasurement = this.calculateMeasurement(
        holding,
        holding.classificationBreakdown.Investment
          ? 'Investment'
          : 'BrokerTrader'
      )
      if (this.settings && originalStandard) {
        this.settings.accountingStandard = originalStandard
      }

      const difference = new Decimal(ifrsMeasurement.carryingAmount).minus(
        new Decimal(gaapMeasurement.carryingAmount)
      )

      if (!difference.eq(0)) {
        adjustments.push({
          description: `${holding.assetSymbol} measurement difference`,
          amount: difference.toString(),
          explanation: `GAAP: ${gaapMeasurement.measurementBasis}, IFRS: ${ifrsMeasurement.measurementBasis}`,
        })

        keyDifferences.push({
          item: holding.assetSymbol,
          gaapTreatment: gaapMeasurement.measurementBasis,
          ifrsTreatment: ifrsMeasurement.measurementBasis,
          impact: difference.toString(),
        })
      }
    }

    return {
      reportDate,
      gaapCarryingAmount: gaapTotal,
      adjustments,
      ifrsCarryingAmount: ifrsTotal,
      keyDifferences,
    }
  }

  /**
   * Calculate total carrying amount under specific standard
   */
  private calculateTotalCarrying(
    holdings: CryptoHolding[],
    standard: AccountingStandard
  ): string {
    const originalStandard = this.settings?.accountingStandard

    if (this.settings) {
      this.settings.accountingStandard = standard
    }

    let total = new Decimal(0)

    for (const holding of holdings) {
      // Determine classification (simplified - would need actual classification data)
      const classification: AssetClassification = holding
        .classificationBreakdown.BrokerTrader
        ? 'BrokerTrader'
        : 'Investment'

      const measurement = this.calculateMeasurement(holding, classification)
      total = total.plus(new Decimal(measurement.carryingAmount))
    }

    if (this.settings && originalStandard) {
      this.settings.accountingStandard = originalStandard
    }

    return total.toString()
  }

  /**
   * Generate disclosure report
   */
  generateDisclosure(
    holdings: CryptoHolding[],
    reportDate: string
  ): DisclosureReport {
    if (!this.settings) {
      throw new Error('Compliance settings not initialized')
    }

    let totalFairValue = new Decimal(0)
    let unrealizedGains = new Decimal(0)
    let unrealizedLosses = new Decimal(0)

    const byClassification: DisclosureReport['byClassification'] = {}
    const significantHoldings: DisclosureReport['significantHoldings'] = []
    const impairmentsByAsset: Record<string, string> = {}
    let totalImpairments = new Decimal(0)

    for (const holding of holdings) {
      const fairValue = new Decimal(holding.currentFairValue)
      totalFairValue = totalFairValue.plus(fairValue)

      // Calculate unrealized gains/losses
      const costBasisMethod =
        this.settings.defaultCostBasisMethod === 'SpecificID'
          ? 'FIFO'
          : this.settings.defaultCostBasisMethod
      const costBasis = new Decimal(holding.costBasis[costBasisMethod])
      const unrealized = fairValue.minus(costBasis)

      if (unrealized.gt(0)) {
        unrealizedGains = unrealizedGains.plus(unrealized)
      } else {
        unrealizedLosses = unrealizedLosses.plus(unrealized.abs())
      }

      // Track impairments
      const impairment = new Decimal(holding.totalImpairment || '0')
      if (impairment.gt(0)) {
        impairmentsByAsset[holding.assetSymbol] = impairment.toString()
        totalImpairments = totalImpairments.plus(impairment)
      }
    }

    // Find significant holdings (>5% of total)
    for (const holding of holdings) {
      const fairValue = new Decimal(holding.currentFairValue)
      const percentOfTotal = totalFairValue.gt(0)
        ? fairValue.div(totalFairValue).mul(100).toNumber()
        : 0

      if (percentOfTotal > 5) {
        significantHoldings.push({
          assetSymbol: holding.assetSymbol,
          quantity: holding.totalQuantity,
          fairValue: fairValue.toString(),
          percentOfTotal,
        })
      }
    }

    return {
      id: `disclosure-${Date.now()}`,
      reportDate,
      standard: this.settings.accountingStandard,
      totalCryptoAssets: totalFairValue.toString(),
      totalFairValue: totalFairValue.toString(),
      unrealizedGains: unrealizedGains.toString(),
      unrealizedLosses: unrealizedLosses.toString(),
      realizedGains: '0', // Would need disposal data
      realizedLosses: '0', // Would need disposal data
      byClassification,
      significantHoldings,
      impairmentSummary: totalImpairments.gt(0)
        ? {
            totalImpairments: totalImpairments.toString(),
            impairmentsByAsset,
          }
        : undefined,
      measurementMethodology: {
        costBasisMethod: this.settings.defaultCostBasisMethod,
        fairValueSource: this.settings.fairValueSource,
        activeMarketDetermination:
          'Based on daily trading volume and market capitalization',
      },
      accountingPolicies: this.getAccountingPoliciesText(),
      significantJudgments: ComplianceService.getSignificantJudgmentsText(),
      createdAt: new Date().toISOString(),
    }
  }

  /**
   * Get accounting policies text for disclosure
   */
  private getAccountingPoliciesText(): string {
    if (!this.settings) return ''

    const standard = this.settings.accountingStandard
    const costMethod = this.settings.defaultCostBasisMethod

    let text = `Crypto assets are accounted for under ${standard === 'US_GAAP' ? 'US GAAP' : standard === 'IFRS' ? 'IFRS' : 'both US GAAP and IFRS'}. `

    text += `Cost basis is determined using the ${costMethod} method. `

    if (standard === 'IFRS' && this.settings.ifrsMeasurementModel) {
      text += `Under IFRS, the ${this.settings.ifrsMeasurementModel} is applied. `
    }

    text += `Fair values are obtained from ${this.settings.fairValueSource} and updated every ${this.settings.fairValueUpdateFrequency} seconds.`

    return text
  }

  /**
   * Get significant judgments text for disclosure
   */
  private static getSignificantJudgmentsText(): string {
    return (
      'Management makes judgments in determining whether an active market exists for crypto assets, ' +
      'which affects the measurement approach. Active markets are identified based on daily trading volume, ' +
      'number of exchanges, and market capitalization. Impairment assessments require judgment in ' +
      'determining whether fair value declines are other-than-temporary.'
    )
  }
}

// Singleton instance
export const complianceService = new ComplianceService()
