import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock persistence before importing priceService
vi.mock('../persistence', () => ({
  persistence: {
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    deleteSetting: vi.fn(),
  },
}))

// Mock Tauri invoke — not available in test
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

// Mock the Tauri availability check — default to true so invoke paths run
vi.mock('../../utils/tauri', () => ({
  isTauriAvailable: vi.fn(() => true),
  warnIfNotTauri: vi.fn(),
}))

import { persistence } from '../persistence'
import { invoke } from '@tauri-apps/api/core'
import {
  loadPriceFeedConfig,
  clearPriceFeedConfigCache,
  getCurrentPrice,
} from '../blockchain/priceService'

const mockGetSetting = vi.mocked(persistence.getSetting)
const mockInvoke = vi.mocked(invoke)

describe('priceService config read-through', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearPriceFeedConfigCache()
  })

  it('loadPriceFeedConfig reads api_key and base_url from persistence', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'price_feed_api_key')
        return Promise.resolve('test-api-key-123')
      if (key === 'price_feed_base_url')
        return Promise.resolve('https://custom.coingecko.example/api/v3')
      return Promise.resolve(null)
    })

    const config = await loadPriceFeedConfig()

    expect(mockGetSetting).toHaveBeenCalledWith('price_feed_api_key')
    expect(mockGetSetting).toHaveBeenCalledWith('price_feed_base_url')
    expect(config.apiKey).toBe('test-api-key-123')
    expect(config.baseUrl).toBe('https://custom.coingecko.example/api/v3')
  })

  it('loadPriceFeedConfig returns nulls when no settings stored', async () => {
    mockGetSetting.mockResolvedValue(null)

    const config = await loadPriceFeedConfig()

    expect(config.apiKey).toBeNull()
    expect(config.baseUrl).toBeNull()
  })

  it('loadPriceFeedConfig caches results for subsequent calls', async () => {
    mockGetSetting.mockResolvedValue(null)

    await loadPriceFeedConfig()
    await loadPriceFeedConfig()

    // getSetting should only be called once (2 keys) due to caching
    expect(mockGetSetting).toHaveBeenCalledTimes(2)
  })

  it('clearPriceFeedConfigCache forces a re-read on next call', async () => {
    mockGetSetting.mockResolvedValue(null)

    await loadPriceFeedConfig()
    clearPriceFeedConfigCache()
    await loadPriceFeedConfig()

    // 2 keys per call * 2 calls = 4
    expect(mockGetSetting).toHaveBeenCalledTimes(4)
  })

  it('getCurrentPrice passes configured apiKey and baseUrl to invoke', async () => {
    mockGetSetting.mockImplementation((key: string) => {
      if (key === 'price_feed_api_key') return Promise.resolve('my-pro-key')
      if (key === 'price_feed_base_url')
        return Promise.resolve('https://pro.example.com/v3')
      return Promise.resolve(null)
    })
    mockInvoke.mockResolvedValue({
      coin_id: 'polkadot',
      price: '7.50',
      currency: 'usd',
    })

    const price = await getCurrentPrice('polkadot', 'usd')

    expect(price).toBe(7.5)
    expect(mockInvoke).toHaveBeenCalledWith('get_crypto_price', {
      coinId: 'polkadot',
      vsCurrency: 'usd',
      apiKey: 'my-pro-key',
      baseUrl: 'https://pro.example.com/v3',
    })
  })

  it('getCurrentPrice omits apiKey/baseUrl when settings are empty', async () => {
    mockGetSetting.mockResolvedValue(null)
    mockInvoke.mockResolvedValue({
      coin_id: 'polkadot',
      price: '6.25',
      currency: 'usd',
    })

    await getCurrentPrice('polkadot', 'usd')

    expect(mockInvoke).toHaveBeenCalledWith('get_crypto_price', {
      coinId: 'polkadot',
      vsCurrency: 'usd',
      apiKey: undefined,
      baseUrl: undefined,
    })
  })

  it('loadPriceFeedConfig handles persistence failure gracefully', async () => {
    mockGetSetting.mockRejectedValue(new Error('DB unavailable'))

    const config = await loadPriceFeedConfig()

    expect(config.apiKey).toBeNull()
    expect(config.baseUrl).toBeNull()
  })
})
