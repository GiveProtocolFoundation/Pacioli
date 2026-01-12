import { describe, it, expect } from 'vitest'
import {
  getCryptoLogoPath,
  getCryptoBrandColor,
  hasCryptoLogo,
  getCryptoConfig,
  addCryptoLogo,
  getAllCryptoSymbols,
  getCryptosWithLogos,
} from '../cryptoLogos'

describe('cryptoLogos', () => {
  describe('getCryptoLogoPath', () => {
    it('should return logo path for known cryptocurrency', () => {
      const path = getCryptoLogoPath('BTC')
      expect(path).toBe('/crypto-icons/btc.svg')
    })

    it('should be case-insensitive', () => {
      expect(getCryptoLogoPath('btc')).toBe('/crypto-icons/btc.svg')
      expect(getCryptoLogoPath('Btc')).toBe('/crypto-icons/btc.svg')
      expect(getCryptoLogoPath('BTC')).toBe('/crypto-icons/btc.svg')
    })

    it('should return null for unknown cryptocurrency', () => {
      const path = getCryptoLogoPath('UNKNOWN')
      expect(path).toBeNull()
    })

    it('should return light theme logo by default', () => {
      const path = getCryptoLogoPath('GLMR')
      expect(path).toBe('/crypto-icons/GLMR_Black.svg')
    })

    it('should return dark theme logo when theme is dark', () => {
      const path = getCryptoLogoPath('GLMR', 'dark')
      expect(path).toBe('/crypto-icons/GLMR_White.svg')
    })

    it('should return regular logo for cryptos without dark variant', () => {
      const lightPath = getCryptoLogoPath('BTC', 'light')
      const darkPath = getCryptoLogoPath('BTC', 'dark')
      expect(lightPath).toBe(darkPath)
    })

    it('should return logo paths for all major cryptocurrencies', () => {
      const cryptos = [
        'BTC',
        'DOT',
        'KSM',
        'GLMR',
        'ASTR',
        'BNC',
        'IBTC',
        'USDC',
        'USDT',
      ]
      cryptos.forEach(symbol => {
        expect(getCryptoLogoPath(symbol)).not.toBeNull()
      })
    })
  })

  describe('getCryptoBrandColor', () => {
    it('should return brand color for Bitcoin', () => {
      expect(getCryptoBrandColor('BTC')).toBe('#F7931A')
    })

    it('should return brand color for Polkadot', () => {
      expect(getCryptoBrandColor('DOT')).toBe('#E6007A')
    })

    it('should return brand color for Kusama', () => {
      expect(getCryptoBrandColor('KSM')).toBe('#000000')
    })

    it('should return brand color for Moonbeam', () => {
      expect(getCryptoBrandColor('GLMR')).toBe('#53CBC8')
    })

    it('should be case-insensitive', () => {
      expect(getCryptoBrandColor('btc')).toBe('#F7931A')
      expect(getCryptoBrandColor('Dot')).toBe('#E6007A')
    })

    it('should return default blue for unknown cryptocurrency', () => {
      expect(getCryptoBrandColor('UNKNOWN')).toBe('#2563EB')
    })
  })

  describe('hasCryptoLogo', () => {
    it('should return true for known cryptocurrency', () => {
      expect(hasCryptoLogo('BTC')).toBe(true)
      expect(hasCryptoLogo('DOT')).toBe(true)
      expect(hasCryptoLogo('USDC')).toBe(true)
    })

    it('should return false for unknown cryptocurrency', () => {
      expect(hasCryptoLogo('UNKNOWN')).toBe(false)
      expect(hasCryptoLogo('XYZ123')).toBe(false)
    })

    it('should be case-insensitive', () => {
      expect(hasCryptoLogo('btc')).toBe(true)
      expect(hasCryptoLogo('Btc')).toBe(true)
    })
  })

  describe('getCryptoConfig', () => {
    it('should return full config for known cryptocurrency', () => {
      const config = getCryptoConfig('BTC')
      expect(config.symbol).toBe('BTC')
      expect(config.logoPath).toBe('/crypto-icons/btc.svg')
      expect(config.color).toBe('#F7931A')
    })

    it('should return config with dark logo path for GLMR', () => {
      const config = getCryptoConfig('GLMR')
      expect(config.logoPath).toBe('/crypto-icons/GLMR_Black.svg')
      expect(config.logoPathDark).toBe('/crypto-icons/GLMR_White.svg')
    })

    it('should return default config for unknown cryptocurrency', () => {
      const config = getCryptoConfig('UNKNOWN')
      expect(config.symbol).toBe('UNKNOWN')
      expect(config.logoPath).toBeNull()
      expect(config.color).toBe('#2563EB')
    })

    it('should be case-insensitive for symbol lookup', () => {
      const config = getCryptoConfig('btc')
      expect(config.symbol).toBe('BTC')
    })
  })

  describe('addCryptoLogo', () => {
    it('should add new cryptocurrency logo', () => {
      // Add a new crypto
      addCryptoLogo('TEST', '/crypto-icons/test.svg', '#FF0000')

      // Verify it was added
      expect(hasCryptoLogo('TEST')).toBe(true)
      expect(getCryptoLogoPath('TEST')).toBe('/crypto-icons/test.svg')
      expect(getCryptoBrandColor('TEST')).toBe('#FF0000')
    })

    it('should uppercase the symbol when adding', () => {
      addCryptoLogo('lowercase', '/crypto-icons/lowercase.svg', '#00FF00')
      expect(hasCryptoLogo('LOWERCASE')).toBe(true)
    })

    it('should override existing cryptocurrency logo', () => {
      const originalPath = getCryptoLogoPath('USDC')
      const originalColor = getCryptoBrandColor('USDC')
      addCryptoLogo('USDC', '/crypto-icons/usdc-new.svg', '#FF00FF')

      expect(getCryptoLogoPath('USDC')).toBe('/crypto-icons/usdc-new.svg')
      expect(getCryptoBrandColor('USDC')).toBe('#FF00FF')

      // Restore original for other tests
      if (originalPath) {
        addCryptoLogo('USDC', originalPath, originalColor)
      }
    })
  })

  describe('getAllCryptoSymbols', () => {
    it('should return array of symbols', () => {
      const symbols = getAllCryptoSymbols()
      expect(Array.isArray(symbols)).toBe(true)
      expect(symbols.length).toBeGreaterThan(0)
    })

    it('should include major cryptocurrencies', () => {
      const symbols = getAllCryptoSymbols()
      expect(symbols).toContain('BTC')
      expect(symbols).toContain('DOT')
      expect(symbols).toContain('KSM')
    })

    it('should return uppercase symbols', () => {
      const symbols = getAllCryptoSymbols()
      symbols.forEach(symbol => {
        expect(symbol).toBe(symbol.toUpperCase())
      })
    })
  })

  describe('getCryptosWithLogos', () => {
    it('should return array of symbols with logos', () => {
      const cryptos = getCryptosWithLogos()
      expect(Array.isArray(cryptos)).toBe(true)
      expect(cryptos.length).toBeGreaterThan(0)
    })

    it('should only include cryptos that have logos', () => {
      const cryptos = getCryptosWithLogos()
      cryptos.forEach(symbol => {
        expect(hasCryptoLogo(symbol)).toBe(true)
      })
    })

    it('should include major cryptocurrencies', () => {
      const cryptos = getCryptosWithLogos()
      expect(cryptos).toContain('BTC')
      expect(cryptos).toContain('DOT')
    })
  })
})
