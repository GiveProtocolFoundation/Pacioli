/**
 * Persistence Layer Types
 * TypeScript types matching the Rust backend types
 */

import type { Transaction, ConnectedWallet } from '../wallet/types'

/**
 * Sync status for a chain/address pair.
 * Used by chain-level transaction operations.
 */
export interface ChainSyncStatus {
  network: string
  address: string
  lastSyncedBlock: number
  lastSyncTime: Date
  isSyncing: boolean
}

export interface Profile {
  id: string
  name: string
  avatar_url?: string | null
  created_at: string
  updated_at: string
}

export interface Wallet {
  id: string
  profile_id: string
  address: string
  chain: string
  name?: string | null
  wallet_type: string
  created_at: string
  updated_at?: string | null
}

export interface WalletInput {
  profile_id: string
  address: string
  chain: string
  name?: string
  wallet_type: string
}

export interface StoredTransaction {
  id: string
  wallet_id: string
  hash: string
  block_number?: number | null
  timestamp?: string | null
  from_address?: string | null
  to_address?: string | null
  value?: string | null
  fee?: string | null
  status?: string | null
  tx_type?: string | null
  token_symbol?: string | null
  token_decimals?: number | null
  chain: string
  raw_data?: string | null
  created_at: string
  /** XCM cross-chain correlation fields */
  xcm_correlation_id?: string | null
  xcm_linked_tx_id?: string | null
  xcm_role?: 'send' | 'receive' | null
  xcm_status?: 'matched' | 'pending' | null
  /** USD price per token unit at the time of acquisition. Used for accurate cost basis. */
  price_at_acquisition_usd?: string | null
}

export interface TransactionInput {
  hash: string
  block_number?: number
  timestamp?: string
  from_address?: string
  to_address?: string
  value?: string
  fee?: string
  status?: string
  tx_type?: string
  token_symbol?: string
  token_decimals?: number
  chain: string
  raw_data?: string
  /** XCM cross-chain correlation fields */
  xcm_correlation_id?: string
  xcm_linked_tx_id?: string
  xcm_role?: 'send' | 'receive'
  xcm_status?: 'matched' | 'pending'
  /** USD price per token unit at the time of acquisition. Used for accurate cost basis. */
  price_at_acquisition_usd?: string
}

export interface PaginationOptions {
  limit?: number
  offset?: number
}

// ============================================================================
// Entity Types
// ============================================================================

export type EntityType = 'vendor' | 'customer' | 'both' | 'other'

export type TaxDocumentationStatus =
  | 'none'
  | 'requested'
  | 'received'
  | 'verified'
  | 'expired'

export interface PostalAddress {
  street?: string
  city?: string
  region?: string
  postal_code?: string
  country_code?: string
}

export interface Entity {
  id: string
  profile_id: string
  entity_type: EntityType
  name: string
  display_name?: string | null
  email?: string | null
  phone?: string | null
  website?: string | null
  address?: string | null // JSON string of PostalAddress
  country_code?: string | null
  tax_identifier?: string | null
  tax_identifier_type?: string | null
  default_wallet_address?: string | null
  category?: string | null
  tags?: string | null // JSON array string
  default_payment_terms?: number | null
  default_currency?: string | null
  reportable_payee: boolean
  tax_documentation_status: TaxDocumentationStatus
  tax_documentation_date?: string | null
  tax_compliance?: string | null // JSON string
  notes?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EntityInput {
  profile_id: string
  entity_type: EntityType
  name: string
  display_name?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  country_code?: string
  tax_identifier?: string
  tax_identifier_type?: string
  default_wallet_address?: string
  category?: string
  tags?: string
  default_payment_terms?: number
  default_currency?: string
  reportable_payee?: boolean
  tax_documentation_status?: TaxDocumentationStatus
  tax_documentation_date?: string
  tax_compliance?: string
  notes?: string
}

export interface EntityUpdate {
  entity_type?: EntityType
  name?: string
  display_name?: string
  email?: string
  phone?: string
  website?: string
  address?: string
  country_code?: string
  tax_identifier?: string
  tax_identifier_type?: string
  default_wallet_address?: string
  category?: string
  tags?: string
  default_payment_terms?: number
  default_currency?: string
  reportable_payee?: boolean
  tax_documentation_status?: TaxDocumentationStatus
  tax_documentation_date?: string
  tax_compliance?: string
  notes?: string
  is_active?: boolean
}

export interface EntityAddress {
  id: string
  entity_id: string
  address: string
  chain: string
  address_type?: string | null
  label?: string | null
  is_verified: boolean
  verified_at?: string | null
  verification_method?: string | null
  created_at: string
}

export interface EntityAddressInput {
  entity_id: string
  address: string
  chain: string
  address_type?: string
  label?: string
  is_verified?: boolean
  verification_method?: string
}

export interface KnownAddress {
  address: string
  chain: string
  entity_name: string
  entity_type?: string | null
  category?: string | null
  subcategory?: string | null
  country_code?: string | null
  website?: string | null
  logo_url?: string | null
  confidence: string
  source?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AddressMatch {
  address: string
  chain: string
  match_type: 'entity' | 'known'
  entity_id?: string | null
  entity_name: string
  entity_type?: string | null
  category?: string | null
  confidence: string
}

export interface EntityFilter {
  entity_type?: EntityType
  is_active?: boolean
}

// ============================================================================
// Bank & Card Transaction Types (GIV-825)
// ============================================================================

export type BankAccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'money_market'
  | 'line_of_credit'
  | 'other'

export interface BankAccount {
  id: string
  institution_name: string
  account_nickname: string
  account_type: BankAccountType
  currency: string
  gl_account_number: string
  external_source?: string | null
  external_account_id?: string | null
  masked_account_number?: string | null
  opening_balance?: string | null
  opening_balance_date?: number | null
  entity_id?: string | null
  active: boolean
  created_at: number
  updated_at: number
}

export interface BankAccountInput {
  institution_name: string
  account_nickname: string
  account_type: BankAccountType
  currency: string
  gl_account_number?: string
  external_source?: string
  external_account_id?: string
  masked_account_number?: string
  opening_balance?: string
  opening_balance_date?: number
  entity_id?: string
}

export interface BankTransaction {
  id: string
  bank_account_id: string
  external_id?: string | null
  posted_date: number
  transaction_date?: number | null
  amount: string
  currency: string
  payee?: string | null
  memo?: string | null
  reference_number?: string | null
  tx_type?: string | null
  running_balance?: string | null
  classification_status: string
  classification_note?: string | null
  raw_data?: string | null
  import_batch_id?: string | null
  created_at: number
  updated_at: number
}

export interface BankTransactionInput {
  bank_account_id: string
  external_id?: string
  posted_date: number
  transaction_date?: number
  amount: string
  currency: string
  payee?: string
  memo?: string
  reference_number?: string
  tx_type?: string
  running_balance?: string
  classification_status?: string
  classification_note?: string
  raw_data?: string
  import_batch_id?: string
}

export interface BankTransactionFilter {
  from_date?: number
  to_date?: number
  classification_status?: string
  import_batch_id?: string
  limit?: number
  offset?: number
}

export interface ImportBatch {
  id: string
  bank_account_id: string
  filename?: string | null
  format?: string | null
  imported_at: number
  row_count?: number | null
  duplicate_count?: number | null
  status: string
}

export interface ImportBatchInput {
  bank_account_id: string
  filename?: string
  format?: string
  row_count?: number
  duplicate_count?: number
  status?: string
}

export interface StatementProfile {
  id: string
  name: string
  institution_name?: string | null
  column_map?: string | null
  date_format?: string | null
  amount_sign_convention?: string | null
  currency_default?: string | null
  created_at: number
  updated_at: number
}

export interface StatementProfileInput {
  name: string
  institution_name?: string
  column_map?: string
  date_format?: string
  amount_sign_convention?: string
  currency_default?: string
}

export interface PersistenceService {
  // Profile operations
  createProfile(name: string): Promise<Profile>
  getProfiles(): Promise<Profile[]>
  updateProfile(id: string, name: string): Promise<Profile>
  deleteProfile(id: string): Promise<void>

  // Wallet operations
  saveWallet(wallet: WalletInput): Promise<Wallet>
  getWallets(profileId: string): Promise<Wallet[]>
  getWalletById(id: string): Promise<Wallet | null>
  deleteWallet(id: string): Promise<void>

  // Transaction operations
  saveTransactions(
    walletId: string,
    transactions: TransactionInput[]
  ): Promise<number>
  getTransactions(
    walletId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]>
  getAllTransactions(
    profileId: string,
    options?: PaginationOptions
  ): Promise<StoredTransaction[]>
  deleteTransactions(walletId: string): Promise<number>

  // Settings operations
  getSetting(key: string): Promise<string | null>
  setSetting(key: string, value: string): Promise<void>
  deleteSetting(key: string): Promise<void>
  getAllSettings(): Promise<Array<[string, string]>>

  // Entity operations
  createEntity(entity: EntityInput): Promise<Entity>
  getEntities(profileId: string, filter?: EntityFilter): Promise<Entity[]>
  getEntityById(id: string): Promise<Entity | null>
  updateEntity(id: string, update: EntityUpdate): Promise<Entity>
  deleteEntity(id: string): Promise<void>
  searchEntities(
    profileId: string,
    query: string,
    limit?: number
  ): Promise<Entity[]>
  findEntityByAddress(
    profileId: string,
    address: string,
    chain?: string
  ): Promise<Entity | null>

  // Entity address operations
  addEntityAddress(address: EntityAddressInput): Promise<EntityAddress>
  getEntityAddresses(entityId: string): Promise<EntityAddress[]>
  deleteEntityAddress(id: string): Promise<void>

  // Chain transaction operations (network+address based, for WalletManager sync)
  initTransactionStore(): Promise<void>
  saveChainTransactions(
    network: string,
    address: string,
    transactions: Transaction[]
  ): Promise<void>
  getChainTransactions(network: string, address: string): Promise<Transaction[]>
  loadChainSyncStatus(
    network: string,
    address: string
  ): Promise<ChainSyncStatus | null>
  saveChainSyncStatus(status: ChainSyncStatus): Promise<void>
  clearChainTransactions(): Promise<void>

  // Connected wallet operations (browser wallet extension state)
  saveConnectedWallets(wallets: ConnectedWallet[]): Promise<void>
  loadConnectedWallets(): Promise<ConnectedWallet[]>

  // Bank account operations (GIV-825)
  getBankAccounts(): Promise<BankAccount[]>
  saveBankAccount(account: BankAccountInput): Promise<BankAccount>

  // Bank transaction operations (GIV-825)
  getBankTransactions(
    bankAccountId: string,
    filter?: BankTransactionFilter
  ): Promise<BankTransaction[]>
  saveBankTransactions(rows: BankTransactionInput[]): Promise<number>

  // Import batch operations (GIV-825)
  getImportBatches(bankAccountId?: string): Promise<ImportBatch[]>
  saveImportBatch(batch: ImportBatchInput): Promise<ImportBatch>

  // Statement profile operations (GIV-825)
  getStatementProfiles(): Promise<StatementProfile[]>
  saveStatementProfile(
    profile: StatementProfileInput
  ): Promise<StatementProfile>

  // Address detection operations
  lookupAddress(
    profileId: string,
    address: string,
    chain: string
  ): Promise<AddressMatch | null>
  batchLookupAddresses(
    profileId: string,
    addresses: Array<[string, string]>
  ): Promise<AddressMatch[]>
  getKnownAddresses(
    chain?: string,
    entityType?: string
  ): Promise<KnownAddress[]>
  createEntityFromKnown(
    profileId: string,
    address: string,
    chain: string
  ): Promise<Entity>
}
