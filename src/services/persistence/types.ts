/**
 * Persistence Layer Types
 * TypeScript types matching the Rust backend types
 */

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
