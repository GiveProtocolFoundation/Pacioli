import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { indexedDBPersistence } from '../indexedDBPersistence'
import type {
  BankAccountInput,
  BankTransactionInput,
  ImportBatchInput,
  StatementProfileInput,
} from '../types'

// Force a fresh DB for each test by resetting the singleton's private state.
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = indexedDBPersistence as any
  if (svc.db) {
    svc.db.close()
    svc.db = null
  }
  svc.initPromise = null
  indexedDB.deleteDatabase('PacioliPersistenceDB')
})

describe('Bank persistence round-trip (GIV-825)', () => {
  // ==========================================================================
  // Bank Accounts
  // ==========================================================================

  it('creates and retrieves a bank account', async () => {
    const input: BankAccountInput = {
      institution_name: 'Chase',
      account_nickname: 'Main Checking',
      account_type: 'checking',
      currency: 'USD',
    }

    const saved = await indexedDBPersistence.saveBankAccount(input)
    expect(saved.id).toBeTruthy()
    expect(saved.institution_name).toBe('Chase')
    expect(saved.gl_account_number).toBe('1000')
    expect(saved.active).toBe(true)

    const all = await indexedDBPersistence.getBankAccounts()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(saved.id)
  })

  it('defaults gl_account_number to 1000', async () => {
    const saved = await indexedDBPersistence.saveBankAccount({
      institution_name: 'BoA',
      account_nickname: 'Savings',
      account_type: 'savings',
      currency: 'USD',
    })
    expect(saved.gl_account_number).toBe('1000')
  })

  // ==========================================================================
  // Bank Transactions — full round-trip
  // ==========================================================================

  it('round-trips: create account → save 100 tx → fetch → mutate → re-fetch', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Wells Fargo',
      account_nickname: 'Operating',
      account_type: 'checking',
      currency: 'USD',
    })

    // Generate 100 transactions with signed amounts
    const rows: BankTransactionInput[] = Array.from(
      { length: 100 },
      (_, i) => ({
        bank_account_id: account.id,
        external_id: `FITID-${String(i).padStart(4, '0')}`,
        posted_date: 1720000000 + i * 86400,
        amount: i % 3 === 0 ? `-${(i + 1) * 10}.00` : `${(i + 1) * 10}.00`,
        currency: 'USD',
        payee: `Vendor ${i}`,
        memo: `Payment #${i}`,
        tx_type: i % 3 === 0 ? 'ach_debit' : 'ach_credit',
      })
    )

    const savedCount = await indexedDBPersistence.saveBankTransactions(rows)
    expect(savedCount).toBe(100)

    // Fetch all for this account
    const fetched = await indexedDBPersistence.getBankTransactions(account.id)
    expect(fetched).toHaveLength(100)
    expect(fetched[0].posted_date).toBeGreaterThanOrEqual(
      fetched[99].posted_date
    )

    // Verify signed amounts
    const debits = fetched.filter(t => parseFloat(t.amount) < 0)
    const credits = fetched.filter(t => parseFloat(t.amount) > 0)
    expect(debits.length).toBe(34) // indices 0,3,6,...,99
    expect(credits.length).toBe(66)

    // Verify composite id pattern
    expect(fetched.some(t => t.id === `${account.id}_FITID-0000`)).toBe(true)

    // Mutate: re-save first 10 with updated payee (upsert by id)
    const updates: BankTransactionInput[] = rows.slice(0, 10).map(r => ({
      ...r,
      payee: `Updated ${r.payee}`,
    }))
    const updateCount = await indexedDBPersistence.saveBankTransactions(updates)
    expect(updateCount).toBe(10)

    // Re-fetch and verify mutation
    const reFetched = await indexedDBPersistence.getBankTransactions(account.id)
    expect(reFetched).toHaveLength(100) // no duplicates
    const updated = reFetched.find(t => t.external_id === 'FITID-0000')
    expect(updated?.payee).toBe('Updated Vendor 0')
  })

  it('filters by date range', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Test Bank',
      account_nickname: 'Checking',
      account_type: 'checking',
      currency: 'USD',
    })

    await indexedDBPersistence.saveBankTransactions([
      {
        bank_account_id: account.id,
        posted_date: 1000,
        amount: '10.00',
        currency: 'USD',
      },
      {
        bank_account_id: account.id,
        posted_date: 2000,
        amount: '20.00',
        currency: 'USD',
      },
      {
        bank_account_id: account.id,
        posted_date: 3000,
        amount: '30.00',
        currency: 'USD',
      },
    ])

    const filtered = await indexedDBPersistence.getBankTransactions(
      account.id,
      {
        from_date: 1500,
        to_date: 2500,
      }
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].amount).toBe('20.00')
  })

  it('filters by classification_status', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Test Bank',
      account_nickname: 'Checking',
      account_type: 'checking',
      currency: 'USD',
    })

    await indexedDBPersistence.saveBankTransactions([
      {
        bank_account_id: account.id,
        posted_date: 1000,
        amount: '10.00',
        currency: 'USD',
      },
      {
        bank_account_id: account.id,
        posted_date: 2000,
        amount: '20.00',
        currency: 'USD',
        classification_status: 'classified',
      },
    ])

    const unclassified = await indexedDBPersistence.getBankTransactions(
      account.id,
      {
        classification_status: 'unclassified',
      }
    )
    expect(unclassified).toHaveLength(1)
    expect(unclassified[0].amount).toBe('10.00')
  })

  it('paginates results', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Test Bank',
      account_nickname: 'Checking',
      account_type: 'checking',
      currency: 'USD',
    })

    const rows: BankTransactionInput[] = Array.from({ length: 20 }, (_, i) => ({
      bank_account_id: account.id,
      external_id: `P-${i}`,
      posted_date: 1000 + i,
      amount: `${i + 1}.00`,
      currency: 'USD',
    }))
    await indexedDBPersistence.saveBankTransactions(rows)

    const page = await indexedDBPersistence.getBankTransactions(account.id, {
      limit: 5,
      offset: 0,
    })
    expect(page).toHaveLength(5)
    // Sorted desc by posted_date, so first page has the latest 5
    expect(page[0].posted_date).toBe(1019)
  })

  // ==========================================================================
  // UNIQUE(bank_account_id, external_id) enforcement
  // ==========================================================================

  it('deduplicates on external_id via upsert', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Chase',
      account_nickname: 'Checking',
      account_type: 'checking',
      currency: 'USD',
    })

    await indexedDBPersistence.saveBankTransactions([
      {
        bank_account_id: account.id,
        external_id: 'FITID-001',
        posted_date: 1000,
        amount: '50.00',
        currency: 'USD',
        payee: 'Original',
      },
    ])
    await indexedDBPersistence.saveBankTransactions([
      {
        bank_account_id: account.id,
        external_id: 'FITID-001',
        posted_date: 1000,
        amount: '50.00',
        currency: 'USD',
        payee: 'Reimport',
      },
    ])

    const all = await indexedDBPersistence.getBankTransactions(account.id)
    expect(all).toHaveLength(1)
    expect(all[0].payee).toBe('Reimport')
  })

  // ==========================================================================
  // Import Batches
  // ==========================================================================

  it('creates and retrieves import batches', async () => {
    const account = await indexedDBPersistence.saveBankAccount({
      institution_name: 'Chase',
      account_nickname: 'Checking',
      account_type: 'checking',
      currency: 'USD',
    })

    const input: ImportBatchInput = {
      bank_account_id: account.id,
      filename: 'chase-july-2026.ofx',
      format: 'ofx',
      row_count: 45,
      duplicate_count: 2,
    }

    const batch = await indexedDBPersistence.saveImportBatch(input)
    expect(batch.id).toBeTruthy()
    expect(batch.status).toBe('staged')
    expect(batch.filename).toBe('chase-july-2026.ofx')

    const all = await indexedDBPersistence.getImportBatches()
    expect(all).toHaveLength(1)

    const byAccount = await indexedDBPersistence.getImportBatches(account.id)
    expect(byAccount).toHaveLength(1)

    const empty = await indexedDBPersistence.getImportBatches('nonexistent')
    expect(empty).toHaveLength(0)
  })

  // ==========================================================================
  // Statement Profiles
  // ==========================================================================

  it('creates and retrieves statement profiles', async () => {
    const input: StatementProfileInput = {
      name: 'Chase CSV',
      institution_name: 'Chase',
      column_map: JSON.stringify({ date: 0, amount: 2, payee: 3, memo: 4 }),
      date_format: 'MM/DD/YYYY',
      amount_sign_convention: 'signed',
      currency_default: 'USD',
    }

    const profile = await indexedDBPersistence.saveStatementProfile(input)
    expect(profile.id).toBeTruthy()
    expect(profile.name).toBe('Chase CSV')
    expect(JSON.parse(profile.column_map!)).toEqual({
      date: 0,
      amount: 2,
      payee: 3,
      memo: 4,
    })

    const all = await indexedDBPersistence.getStatementProfiles()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(profile.id)
  })
})
