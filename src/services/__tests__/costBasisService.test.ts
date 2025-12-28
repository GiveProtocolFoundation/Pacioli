import { describe, it, expect } from 'vitest'
import {
  calculateAllMethods,
  calculateCostBasis,
  updateLotsAfterDisposal,
  calculateHoldingPeriod,
  calculateGainLoss,
  calculateWeightedAverage,
  validateLots,
} from '../costBasisService'
import type { CryptoLot } from '../../types/cryptoAccounting'

// Helper to create test lots
function createLot(
  lotId: string,
  acquisitionDate: string,
  quantity: string,
  costPerUnit: string,
  remainingQuantity?: string
): CryptoLot {
  const qty = remainingQuantity ?? quantity
  const cost = (parseFloat(quantity) * parseFloat(costPerUnit)).toString()
  return {
    lotId,
    acquisitionDate,
    quantity,
    remainingQuantity: qty,
    acquisitionCost: cost,
    costPerUnit,
    fairValueAtAcquisition: costPerUnit,
    currentFairValue: costPerUnit,
    lastFairValueUpdate: acquisitionDate,
    assetSymbol: 'BTC',
    classification: 'held-for-investment',
    measurementBasis: 'historical-cost',
  } as CryptoLot
}

describe('costBasisService', () => {
  // Sample lots for testing
  const sampleLots: CryptoLot[] = [
    createLot('lot1', '2023-01-15', '1.0', '20000'), // Oldest, mid-price
    createLot('lot2', '2023-03-20', '0.5', '25000'), // Middle age, high price
    createLot('lot3', '2023-06-10', '1.5', '18000'), // Newest, low price
  ]

  describe('calculateAllMethods', () => {
    it('should calculate cost basis for all methods', () => {
      const result = calculateAllMethods(sampleLots, '1.0')

      expect(result.FIFO).toBeDefined()
      expect(result.LIFO).toBeDefined()
      expect(result.HIFO).toBeDefined()
    })

    it('should return different values for different methods', () => {
      const result = calculateAllMethods(sampleLots, '1.0')

      // With different prices, methods should give different results
      // FIFO uses oldest (lot1: 1.0 * 20000 = 20000)
      // LIFO uses newest (lot3: 1.0 * 18000 = 18000)
      // HIFO uses highest first (lot2: 0.5 * 25000 = 12500, then lot1: 0.5 * 20000 = 10000) = 22500
      expect(result.FIFO).toBe('20000')
      expect(result.LIFO).toBe('18000')
      expect(result.HIFO).toBe('22500')
    })

    it('should handle disposal date filter', () => {
      // Only lots before March should be available
      const result = calculateAllMethods(sampleLots, '0.5', '2023-02-01')

      // Only lot1 is available
      expect(result.FIFO).toBe('10000') // 0.5 * 20000
    })
  })

  describe('calculateCostBasis', () => {
    describe('FIFO method', () => {
      it('should use oldest lots first', () => {
        const result = calculateCostBasis(
          {
            assetSymbol: 'BTC',
            quantity: '1.0',
            disposalDate: '2023-12-01',
            method: 'FIFO',
          },
          sampleLots
        )

        expect(result.totalCostBasis).toBe('20000')
        expect(result.lotsUsed).toHaveLength(1)
        expect(result.lotsUsed[0].lotId).toBe('lot1')
      })

      it('should use multiple lots when needed', () => {
        const result = calculateCostBasis(
          {
            assetSymbol: 'BTC',
            quantity: '1.5',
            disposalDate: '2023-12-01',
            method: 'FIFO',
          },
          sampleLots
        )

        // Should use lot1 (1.0) and part of lot2 (0.5)
        expect(result.lotsUsed.length).toBeGreaterThan(1)
        expect(result.lotsUsed[0].lotId).toBe('lot1')
      })
    })

    describe('LIFO method', () => {
      it('should use newest lots first', () => {
        const result = calculateCostBasis(
          {
            assetSymbol: 'BTC',
            quantity: '1.0',
            disposalDate: '2023-12-01',
            method: 'LIFO',
          },
          sampleLots
        )

        expect(result.totalCostBasis).toBe('18000')
        expect(result.lotsUsed[0].lotId).toBe('lot3')
      })
    })

    describe('HIFO method', () => {
      it('should use highest cost lots first', () => {
        const result = calculateCostBasis(
          {
            assetSymbol: 'BTC',
            quantity: '0.5',
            disposalDate: '2023-12-01',
            method: 'HIFO',
          },
          sampleLots
        )

        expect(result.totalCostBasis).toBe('12500') // 0.5 * 25000
        expect(result.lotsUsed[0].lotId).toBe('lot2')
      })
    })

    describe('SpecificID method', () => {
      it('should use specified lots', () => {
        const result = calculateCostBasis(
          {
            assetSymbol: 'BTC',
            quantity: '0.5',
            disposalDate: '2023-12-01',
            method: 'SpecificID',
            specificLotIds: ['lot3'],
          },
          sampleLots
        )

        expect(result.lotsUsed[0].lotId).toBe('lot3')
        expect(result.totalCostBasis).toBe('9000') // 0.5 * 18000
      })

      it('should throw if no lot IDs provided', () => {
        expect(() =>
          calculateCostBasis(
            {
              assetSymbol: 'BTC',
              quantity: '1.0',
              disposalDate: '2023-12-01',
              method: 'SpecificID',
            },
            sampleLots
          )
        ).toThrow('Specific lot IDs required')
      })

      it('should throw if lot IDs not found', () => {
        expect(() =>
          calculateCostBasis(
            {
              assetSymbol: 'BTC',
              quantity: '1.0',
              disposalDate: '2023-12-01',
              method: 'SpecificID',
              specificLotIds: ['nonexistent'],
            },
            sampleLots
          )
        ).toThrow('No matching lots found')
      })
    })

    describe('error handling', () => {
      it('should throw for insufficient quantity', () => {
        expect(() =>
          calculateCostBasis(
            {
              assetSymbol: 'BTC',
              quantity: '10.0', // More than available
              disposalDate: '2023-12-01',
              method: 'FIFO',
            },
            sampleLots
          )
        ).toThrow('Insufficient quantity')
      })

      it('should throw for unknown method', () => {
        expect(() =>
          calculateCostBasis(
            {
              assetSymbol: 'BTC',
              quantity: '1.0',
              disposalDate: '2023-12-01',
              // @ts-expect-error testing invalid method
              method: 'UNKNOWN',
            },
            sampleLots
          )
        ).toThrow('Unknown cost basis method')
      })
    })
  })

  describe('updateLotsAfterDisposal', () => {
    it('should reduce remaining quantity in used lots', () => {
      const disposal = {
        totalCostBasis: '20000',
        averageCostPerUnit: '20000',
        lotsUsed: [{ lotId: 'lot1', quantityUsed: '0.5', costBasis: '10000' }],
      }

      const updated = updateLotsAfterDisposal(sampleLots, disposal)
      const lot1 = updated.find(l => l.lotId === 'lot1')

      expect(lot1?.remainingQuantity).toBe('0.5')
    })

    it('should not modify lots not in disposal', () => {
      const disposal = {
        totalCostBasis: '20000',
        averageCostPerUnit: '20000',
        lotsUsed: [{ lotId: 'lot1', quantityUsed: '0.5', costBasis: '10000' }],
      }

      const updated = updateLotsAfterDisposal(sampleLots, disposal)
      const lot2 = updated.find(l => l.lotId === 'lot2')
      const lot3 = updated.find(l => l.lotId === 'lot3')

      expect(lot2?.remainingQuantity).toBe('0.5')
      expect(lot3?.remainingQuantity).toBe('1.5')
    })

    it('should handle multiple lots in disposal', () => {
      const disposal = {
        totalCostBasis: '32500',
        averageCostPerUnit: '21666.67',
        lotsUsed: [
          { lotId: 'lot1', quantityUsed: '1.0', costBasis: '20000' },
          { lotId: 'lot2', quantityUsed: '0.5', costBasis: '12500' },
        ],
      }

      const updated = updateLotsAfterDisposal(sampleLots, disposal)
      const lot1 = updated.find(l => l.lotId === 'lot1')
      const lot2 = updated.find(l => l.lotId === 'lot2')

      expect(lot1?.remainingQuantity).toBe('0')
      expect(lot2?.remainingQuantity).toBe('0')
    })
  })

  describe('calculateHoldingPeriod', () => {
    it('should calculate days held', () => {
      const result = calculateHoldingPeriod('2023-01-01', '2023-01-31')
      expect(result.days).toBe(30)
    })

    it('should identify short-term holdings (<=365 days)', () => {
      const result = calculateHoldingPeriod('2023-01-01', '2023-12-31')
      expect(result.days).toBe(364)
      expect(result.isLongTerm).toBe(false)
    })

    it('should identify long-term holdings (>365 days)', () => {
      const result = calculateHoldingPeriod('2023-01-01', '2024-01-02')
      expect(result.days).toBe(366)
      expect(result.isLongTerm).toBe(true)
    })

    it('should handle same-day disposal', () => {
      const result = calculateHoldingPeriod('2023-06-15', '2023-06-15')
      expect(result.days).toBe(0)
      expect(result.isLongTerm).toBe(false)
    })

    it('should handle exactly one year', () => {
      const result = calculateHoldingPeriod('2023-01-01', '2024-01-01')
      expect(result.days).toBe(365)
      expect(result.isLongTerm).toBe(false) // Must be > 365, not >= 365
    })
  })

  describe('calculateGainLoss', () => {
    it('should calculate a gain', () => {
      const result = calculateGainLoss('10000', '15000')
      expect(result.gainLoss).toBe('5000')
      expect(result.isGain).toBe(true)
    })

    it('should calculate a loss', () => {
      const result = calculateGainLoss('10000', '8000')
      expect(result.gainLoss).toBe('-2000')
      expect(result.isGain).toBe(false)
    })

    it('should handle break-even', () => {
      const result = calculateGainLoss('10000', '10000')
      expect(result.gainLoss).toBe('0')
      expect(result.isGain).toBe(true) // Zero is considered not a loss
    })

    it('should handle decimal values', () => {
      const result = calculateGainLoss('10000.50', '10500.75')
      expect(parseFloat(result.gainLoss)).toBeCloseTo(500.25, 2)
      expect(result.isGain).toBe(true)
    })
  })

  describe('calculateWeightedAverage', () => {
    it('should calculate weighted average cost', () => {
      const result = calculateWeightedAverage(sampleLots)
      // Total cost: 20000 + 12500 + 27000 = 59500
      // Total quantity: 1.0 + 0.5 + 1.5 = 3.0
      // Average: 59500 / 3.0 = 19833.33...
      expect(parseFloat(result)).toBeCloseTo(19833.33, 0)
    })

    it('should return 0 for empty lots', () => {
      const result = calculateWeightedAverage([])
      expect(result).toBe('0')
    })

    it('should only consider lots with remaining quantity', () => {
      const lotsWithEmpty = [
        ...sampleLots,
        createLot('lot4', '2023-07-01', '1.0', '30000', '0'), // Fully used
      ]
      const result = calculateWeightedAverage(lotsWithEmpty)
      // Should be same as without the empty lot
      expect(parseFloat(result)).toBeCloseTo(19833.33, 0)
    })

    it('should handle single lot', () => {
      const singleLot = [createLot('lot1', '2023-01-01', '1.0', '25000')]
      const result = calculateWeightedAverage(singleLot)
      expect(result).toBe('25000')
    })
  })

  describe('validateLots', () => {
    it('should pass for valid lots', () => {
      const result = validateLots(sampleLots)
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail if remaining > total quantity', () => {
      const invalidLot = createLot('bad', '2023-01-01', '1.0', '20000', '2.0')
      const result = validateLots([invalidLot])
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('exceeds total'))).toBe(true)
    })

    it('should fail for negative remaining quantity', () => {
      const invalidLot = createLot('bad', '2023-01-01', '1.0', '20000', '-0.5')
      const result = validateLots([invalidLot])
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('Negative'))).toBe(true)
    })

    it('should fail for cost mismatch', () => {
      const invalidLot: CryptoLot = {
        ...createLot('bad', '2023-01-01', '1.0', '20000'),
        acquisitionCost: '15000', // Doesn't match 1.0 * 20000
      }
      const result = validateLots([invalidLot])
      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('mismatch'))).toBe(true)
    })

    it('should fail for invalid date', () => {
      const invalidLot = createLot('bad', 'not-a-date', '1.0', '20000')
      const result = validateLots([invalidLot])
      expect(result.isValid).toBe(false)
      expect(
        result.errors.some(e => e.includes('Invalid acquisition date'))
      ).toBe(true)
    })

    it('should collect multiple errors', () => {
      const invalidLot1 = createLot('bad1', '2023-01-01', '1.0', '20000', '2.0')
      const invalidLot2 = createLot(
        'bad2',
        '2023-01-01',
        '1.0',
        '20000',
        '-0.5'
      )
      const result = validateLots([invalidLot1, invalidLot2])
      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThanOrEqual(2)
    })
  })
})
