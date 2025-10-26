/**
 * Cost Basis Calculation Service
 * Implements FIFO, LIFO, HIFO, and Specific ID methods for crypto asset accounting
 */

import Decimal from 'decimal.js';
import { CryptoLot, CostBasisMethod } from '../types/cryptoAccounting';

export interface DisposalRequest {
  assetSymbol: string;
  quantity: string;
  disposalDate: string;
  method: CostBasisMethod;
  specificLotIds?: string[];  // For Specific ID method
}

export interface DisposalResult {
  totalCostBasis: string;
  averageCostPerUnit: string;
  lotsUsed: {
    lotId: string;
    quantityUsed: string;
    costBasis: string;
  }[];
}

export interface CostBasisCalculation {
  FIFO: string;
  LIFO: string;
  HIFO: string;
  SpecificID?: string;
}

/**
 * Cost Basis Service
 */
export class CostBasisService {
  /**
   * Calculate cost basis for all methods
   */
  calculateAllMethods(
    lots: CryptoLot[],
    quantity: string,
    disposalDate?: string
  ): CostBasisCalculation {
    const availableLots = this.getAvailableLots(lots, disposalDate);

    return {
      FIFO: this.calculateFIFO(availableLots, quantity).totalCostBasis,
      LIFO: this.calculateLIFO(availableLots, quantity).totalCostBasis,
      HIFO: this.calculateHIFO(availableLots, quantity).totalCostBasis,
    };
  }

  /**
   * Calculate cost basis using selected method
   */
  calculateCostBasis(request: DisposalRequest, lots: CryptoLot[]): DisposalResult {
    const availableLots = this.getAvailableLots(lots, request.disposalDate);

    switch (request.method) {
      case 'FIFO':
        return this.calculateFIFO(availableLots, request.quantity);
      case 'LIFO':
        return this.calculateLIFO(availableLots, request.quantity);
      case 'HIFO':
        return this.calculateHIFO(availableLots, request.quantity);
      case 'SpecificID':
        if (!request.specificLotIds || request.specificLotIds.length === 0) {
          throw new Error('Specific lot IDs required for Specific ID method');
        }
        return this.calculateSpecificID(availableLots, request.quantity, request.specificLotIds);
      default:
        throw new Error(`Unknown cost basis method: ${request.method}`);
    }
  }

  /**
   * FIFO: First In, First Out
   * Use oldest lots first
   */
  private calculateFIFO(lots: CryptoLot[], quantity: string): DisposalResult {
    // Sort by acquisition date (oldest first)
    const sortedLots = [...lots].sort((a, b) =>
      new Date(a.acquisitionDate).getTime() - new Date(b.acquisitionDate).getTime()
    );

    return this.allocateFromLots(sortedLots, quantity);
  }

  /**
   * LIFO: Last In, First Out
   * Use newest lots first
   */
  private calculateLIFO(lots: CryptoLot[], quantity: string): DisposalResult {
    // Sort by acquisition date (newest first)
    const sortedLots = [...lots].sort((a, b) =>
      new Date(b.acquisitionDate).getTime() - new Date(a.acquisitionDate).getTime()
    );

    return this.allocateFromLots(sortedLots, quantity);
  }

  /**
   * HIFO: Highest In, First Out
   * Use highest cost lots first (maximizes current period deductions)
   */
  private calculateHIFO(lots: CryptoLot[], quantity: string): DisposalResult {
    // Sort by cost per unit (highest first)
    const sortedLots = [...lots].sort((a, b) =>
      new Decimal(b.costPerUnit).cmp(new Decimal(a.costPerUnit))
    );

    return this.allocateFromLots(sortedLots, quantity);
  }

  /**
   * Specific ID: Use specifically identified lots
   * Taxpayer chooses specific lots
   */
  private calculateSpecificID(
    lots: CryptoLot[],
    quantity: string,
    lotIds: string[]
  ): DisposalResult {
    // Filter to only specified lots
    const specifiedLots = lots.filter(lot => lotIds.includes(lot.lotId));

    if (specifiedLots.length === 0) {
      throw new Error('No matching lots found for specified lot IDs');
    }

    // Sort specified lots by the order they were provided
    const sortedLots = specifiedLots.sort((a, b) => {
      const indexA = lotIds.indexOf(a.lotId);
      const indexB = lotIds.indexOf(b.lotId);
      return indexA - indexB;
    });

    return this.allocateFromLots(sortedLots, quantity);
  }

  /**
   * Core allocation logic: allocate quantity from lots
   */
  private allocateFromLots(lots: CryptoLot[], quantity: string): DisposalResult {
    const quantityNeeded = new Decimal(quantity);
    let quantityRemaining = quantityNeeded;
    let totalCost = new Decimal(0);
    const lotsUsed: { lotId: string; quantityUsed: string; costBasis: string }[] = [];

    for (const lot of lots) {
      if (quantityRemaining.lte(0)) break;

      const availableInLot = new Decimal(lot.remainingQuantity);
      if (availableInLot.lte(0)) continue;

      // Determine how much to take from this lot
      const quantityFromLot = Decimal.min(quantityRemaining, availableInLot);

      // Calculate cost basis for this portion
      const costPerUnit = new Decimal(lot.costPerUnit);
      const costFromLot = quantityFromLot.mul(costPerUnit);

      totalCost = totalCost.plus(costFromLot);
      quantityRemaining = quantityRemaining.minus(quantityFromLot);

      lotsUsed.push({
        lotId: lot.lotId,
        quantityUsed: quantityFromLot.toString(),
        costBasis: costFromLot.toString(),
      });
    }

    if (quantityRemaining.gt(0)) {
      throw new Error(
        `Insufficient quantity in lots. Needed ${quantity}, found ${quantityNeeded.minus(quantityRemaining).toString()}`
      );
    }

    const averageCostPerUnit = totalCost.div(quantityNeeded);

    return {
      totalCostBasis: totalCost.toString(),
      averageCostPerUnit: averageCostPerUnit.toString(),
      lotsUsed,
    };
  }

  /**
   * Get lots available on or before a specific date
   */
  private getAvailableLots(lots: CryptoLot[], date?: string): CryptoLot[] {
    if (!date) {
      return lots.filter(lot => new Decimal(lot.remainingQuantity).gt(0));
    }

    const disposalTime = new Date(date).getTime();
    return lots.filter(lot => {
      const acquisitionTime = new Date(lot.acquisitionDate).getTime();
      const hasQuantity = new Decimal(lot.remainingQuantity).gt(0);
      return hasQuantity && acquisitionTime <= disposalTime;
    });
  }

  /**
   * Update lot quantities after a disposal
   */
  updateLotsAfterDisposal(
    lots: CryptoLot[],
    disposal: DisposalResult
  ): CryptoLot[] {
    const updatedLots = [...lots];

    for (const used of disposal.lotsUsed) {
      const lotIndex = updatedLots.findIndex(l => l.lotId === used.lotId);
      if (lotIndex === -1) continue;

      const lot = updatedLots[lotIndex];
      const newRemaining = new Decimal(lot.remainingQuantity)
        .minus(new Decimal(used.quantityUsed))
        .toString();

      updatedLots[lotIndex] = {
        ...lot,
        remainingQuantity: newRemaining,
      };
    }

    return updatedLots;
  }

  /**
   * Calculate holding period for tax purposes
   */
  calculateHoldingPeriod(
    acquisitionDate: string,
    disposalDate: string
  ): { days: number; isLongTerm: boolean } {
    const acqTime = new Date(acquisitionDate).getTime();
    const dispTime = new Date(disposalDate).getTime();
    const days = Math.floor((dispTime - acqTime) / (1000 * 60 * 60 * 24));

    // In the US, long-term capital gains require >365 days holding
    const isLongTerm = days > 365;

    return { days, isLongTerm };
  }

  /**
   * Calculate gain/loss from disposal
   */
  calculateGainLoss(
    costBasis: string,
    proceeds: string
  ): { gainLoss: string; isGain: boolean } {
    const cost = new Decimal(costBasis);
    const proceedsDecimal = new Decimal(proceeds);
    const gainLoss = proceedsDecimal.minus(cost);

    return {
      gainLoss: gainLoss.toString(),
      isGain: gainLoss.gte(0),
    };
  }

  /**
   * Get weighted average cost
   * Useful for certain reporting scenarios
   */
  calculateWeightedAverage(lots: CryptoLot[]): string {
    const activeLots = lots.filter(lot =>
      new Decimal(lot.remainingQuantity).gt(0)
    );

    if (activeLots.length === 0) return '0';

    let totalCost = new Decimal(0);
    let totalQuantity = new Decimal(0);

    for (const lot of activeLots) {
      const lotQuantity = new Decimal(lot.remainingQuantity);
      const lotCost = new Decimal(lot.costPerUnit).mul(lotQuantity);

      totalCost = totalCost.plus(lotCost);
      totalQuantity = totalQuantity.plus(lotQuantity);
    }

    if (totalQuantity.eq(0)) return '0';

    return totalCost.div(totalQuantity).toString();
  }

  /**
   * Validate lot data integrity
   */
  validateLots(lots: CryptoLot[]): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const lot of lots) {
      // Check quantities
      const quantity = new Decimal(lot.quantity);
      const remaining = new Decimal(lot.remainingQuantity);

      if (remaining.gt(quantity)) {
        errors.push(`Lot ${lot.lotId}: Remaining quantity exceeds total quantity`);
      }

      if (remaining.lt(0)) {
        errors.push(`Lot ${lot.lotId}: Negative remaining quantity`);
      }

      // Check cost values
      const costPerUnit = new Decimal(lot.costPerUnit);
      const acquisitionCost = new Decimal(lot.acquisitionCost);
      const expectedCost = costPerUnit.mul(quantity);

      if (!expectedCost.eq(acquisitionCost)) {
        errors.push(
          `Lot ${lot.lotId}: Acquisition cost mismatch (expected ${expectedCost}, got ${acquisitionCost})`
        );
      }

      // Check dates
      const acqDate = new Date(lot.acquisitionDate);
      if (isNaN(acqDate.getTime())) {
        errors.push(`Lot ${lot.lotId}: Invalid acquisition date`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const costBasisService = new CostBasisService();
