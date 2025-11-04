-- ============================================
-- PACIOLI WALLET CONNECTION SYSTEM
-- Migration: 001_wallet_system_schema.sql
-- Description: Core schema for multi-chain wallet management
-- Version: 1.0.0
-- ============================================

-- Enable foreign key support (must be set per connection)
PRAGMA foreign_keys = ON;

-- ============================================
-- SCHEMA MIGRATIONS TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    checksum TEXT, -- SHA256 of migration SQL
    execution_time_ms INTEGER
);

-- Record this migration
INSERT INTO schema_migrations (version, name, description, checksum)
VALUES (1, '001_wallet_system_schema', 'Core wallet connection and account management schema', 'TBD');

-- ============================================
-- WALLET PROVIDERS AND CONNECTIONS
-- ============================================

-- Wallet providers (MetaMask, Polkadot.js, Talisman, etc.)
CREATE TABLE wallet_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_type TEXT NOT NULL CHECK(provider_type IN ('substrate', 'evm', 'unified')),
    provider_name TEXT NOT NULL, -- 'polkadot-js', 'metamask', 'talisman', 'subwallet', etc.
    version TEXT,
    -- Capabilities: { signing, encryption, accounts, chains }
    capabilities JSON CHECK(json_valid(capabilities)),
    icon_url TEXT,
    homepage_url TEXT,
    is_browser_extension BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_name)
);

-- Seed common providers
INSERT INTO wallet_providers (provider_type, provider_name, capabilities) VALUES
    ('substrate', 'polkadot-js', '{"signing": true, "encryption": true, "accounts": "multiple"}'),
    ('substrate', 'talisman', '{"signing": true, "encryption": true, "accounts": "multiple"}'),
    ('substrate', 'subwallet', '{"signing": true, "encryption": true, "accounts": "multiple"}'),
    ('evm', 'metamask', '{"signing": true, "encryption": false, "accounts": "multiple"}'),
    ('evm', 'rabby', '{"signing": true, "encryption": false, "accounts": "multiple"}'),
    ('unified', 'talisman', '{"signing": true, "encryption": true, "accounts": "multiple", "substrate": true, "evm": true}');

-- Master wallet connections (one per wallet extension/connection)
CREATE TABLE wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_uid TEXT UNIQUE NOT NULL, -- UUID v4 generated on first connection
    provider_id INTEGER NOT NULL REFERENCES wallet_providers(id) ON DELETE RESTRICT,
    wallet_name TEXT NOT NULL, -- User-defined friendly name
    wallet_type TEXT NOT NULL CHECK(wallet_type IN ('substrate', 'evm', 'unified')),
    -- Connection metadata: { extension_id, session_data, origin, etc. }
    connection_metadata JSON CHECK(json_valid(connection_metadata)),
    is_read_only BOOLEAN DEFAULT TRUE, -- False if wallet supports signing
    is_active BOOLEAN DEFAULT TRUE,
    last_connected_at TIMESTAMP,
    last_sync_at TIMESTAMP,
    sync_from_block INTEGER, -- Earliest block to sync from (per chain)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP, -- Soft delete
    archived_reason TEXT,
    notes TEXT -- User notes about this wallet
);

CREATE INDEX idx_wallets_active ON wallets(is_active) WHERE archived_at IS NULL;
CREATE INDEX idx_wallets_provider ON wallets(provider_id);

-- Wallet connection session tracking
CREATE TABLE wallet_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    session_token TEXT UNIQUE NOT NULL, -- Cryptographically random token
    expires_at TIMESTAMP NOT NULL,
    ip_address TEXT, -- For audit purposes
    user_agent TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_sessions_active ON wallet_sessions(session_token) WHERE is_active = TRUE;
CREATE INDEX idx_wallet_sessions_wallet ON wallet_sessions(wallet_id, is_active);

-- Wallet connection events (audit trail)
CREATE TABLE wallet_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK(event_type IN (
        'connected', 'disconnected', 'account_added', 'account_removed',
        'chain_changed', 'error', 'sync_started', 'sync_completed', 'sync_failed'
    )),
    event_data JSON CHECK(json_valid(event_data)),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_events_lookup ON wallet_events(wallet_id, created_at DESC);
CREATE INDEX idx_wallet_events_type ON wallet_events(event_type, created_at DESC);

-- ============================================
-- ACCOUNTS (ADDRESSES WITHIN WALLETS)
-- ============================================

-- Individual accounts/addresses within wallets
CREATE TABLE accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_id INTEGER NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    account_address TEXT NOT NULL, -- The actual address (SS58 or hex)
    account_format TEXT NOT NULL CHECK(account_format IN ('ss58', 'ethereum', 'h160_unified')),
    ss58_prefix INTEGER, -- For Substrate addresses (0=Polkadot, 2=Kusama, etc.)
    account_name TEXT, -- User-defined label
    account_type TEXT CHECK(account_type IN ('primary', 'derived', 'ledger', 'multisig', 'watch_only')),
    derivation_path TEXT, -- HD wallet derivation path if known
    parent_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMP,
    archived_reason TEXT,
    -- Modified constraint: Allow same address with different formats
    UNIQUE(wallet_id, account_address, account_format)
);

CREATE INDEX idx_accounts_address ON accounts(account_address);
CREATE INDEX idx_accounts_wallet ON accounts(wallet_id) WHERE is_active = TRUE;
CREATE INDEX idx_accounts_active ON accounts(is_active) WHERE archived_at IS NULL;

-- ============================================
-- BLOCKCHAIN AND NETWORK CONFIGURATION
-- ============================================

-- Supported blockchain networks
CREATE TABLE chains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT UNIQUE NOT NULL, -- 'polkadot', 'kusama', 'moonbeam', '1284', etc.
    chain_name TEXT NOT NULL,
    chain_type TEXT NOT NULL CHECK(chain_type IN ('relay', 'parachain', 'evm', 'solo')),
    parent_chain_id INTEGER REFERENCES chains(id) ON DELETE SET NULL, -- For parachains
    ss58_prefix INTEGER, -- For Substrate chains
    evm_chain_id INTEGER, -- For EVM chains (1284 for Moonbeam, etc.)
    native_token_symbol TEXT NOT NULL,
    native_token_decimals INTEGER NOT NULL,
    -- RPC endpoints: [{ url, priority, is_active, ws_support }]
    rpc_endpoints JSON CHECK(json_valid(rpc_endpoints) AND json_type(rpc_endpoints) = 'array'),
    -- Indexer endpoints: [{ url, type: 'subquery'|'subsquid'|'graph', is_active }]
    indexer_endpoints JSON CHECK(json_valid(indexer_endpoints)),
    explorer_url TEXT,
    icon_url TEXT,
    -- Chain metadata: { runtime_version, spec_name, genesis_hash, etc. }
    metadata JSON CHECK(json_valid(metadata)),
    is_testnet BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chains_type ON chains(chain_type, is_active);
CREATE INDEX idx_chains_active ON chains(is_active);

-- RPC endpoint health tracking
CREATE TABLE rpc_endpoint_health (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    endpoint_url TEXT NOT NULL,
    latency_ms INTEGER,
    block_height INTEGER, -- Last known block height
    is_available BOOLEAN DEFAULT TRUE,
    is_syncing BOOLEAN DEFAULT FALSE,
    last_error TEXT,
    consecutive_failures INTEGER DEFAULT 0,
    last_success_at TIMESTAMP,
    last_checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, endpoint_url)
);

CREATE INDEX idx_rpc_health_available ON rpc_endpoint_health(chain_id, is_available, latency_ms);

-- Account presence on specific chains
CREATE TABLE account_chains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    chain_specific_address TEXT, -- May differ from account_address (e.g., H160 on EVM)
    first_seen_block INTEGER,
    first_seen_at TIMESTAMP,
    last_seen_block INTEGER,
    last_seen_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, chain_id)
);

CREATE INDEX idx_account_chains_lookup ON account_chains(account_id, chain_id);
CREATE INDEX idx_account_chains_active ON account_chains(chain_id, is_active);

-- ============================================
-- ASSET AND TOKEN MANAGEMENT
-- ============================================

-- Master asset registry
-- asset_uid format: {chain_id}:{type}:{identifier}
-- Examples:
--   polkadot:native:DOT
--   moonbeam:erc20:0x818ec0A7Fe18Ff94269904fCED6AE3DaE6d6dC0b
--   statemint:asset:1984
CREATE TABLE assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_uid TEXT UNIQUE NOT NULL, -- Universal identifier (see format above)
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    asset_type TEXT NOT NULL CHECK(asset_type IN (
        'native', 'substrate_asset', 'erc20', 'erc721', 'erc1155',
        'psp22', 'psp34', 'xcm_asset'
    )),
    contract_address TEXT, -- For smart contract tokens
    asset_id TEXT, -- For Substrate assets
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    decimals INTEGER NOT NULL,
    -- Metadata
    total_supply TEXT, -- String to handle large numbers
    is_stablecoin BOOLEAN DEFAULT FALSE,
    is_wrapped BOOLEAN DEFAULT FALSE,
    underlying_asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL, -- For wrapped tokens
    coingecko_id TEXT, -- For price feeds
    coinmarketcap_id TEXT,
    icon_url TEXT,
    -- Additional metadata: { description, website, social, tags }
    metadata JSON CHECK(json_valid(metadata)),
    -- Tracking
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain_id, contract_address) WHERE contract_address IS NOT NULL,
    UNIQUE(chain_id, asset_id) WHERE asset_id IS NOT NULL,
    -- Validate asset_uid format
    CHECK(asset_uid GLOB '*:*:*')
);

CREATE INDEX idx_assets_chain ON assets(chain_id, is_active);
CREATE INDEX idx_assets_symbol ON assets(symbol);
CREATE INDEX idx_assets_type ON assets(asset_type, chain_id);
CREATE INDEX idx_assets_coingecko ON assets(coingecko_id) WHERE coingecko_id IS NOT NULL;

-- Asset prices for valuation
CREATE TABLE asset_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    price_usd TEXT NOT NULL, -- String for precision
    price_btc TEXT,
    price_eth TEXT,
    market_cap_usd TEXT,
    volume_24h_usd TEXT,
    price_change_24h_pct REAL,
    source TEXT NOT NULL CHECK(source IN ('coingecko', 'chainlink', 'dia', 'manual', 'calculated')),
    recorded_at TIMESTAMP NOT NULL, -- ISO 8601 UTC timestamp
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(asset_id, source, recorded_at)
);

CREATE INDEX idx_asset_prices_lookup ON asset_prices(asset_id, recorded_at DESC);
CREATE INDEX idx_asset_prices_recent ON asset_prices(asset_id, source)
    WHERE recorded_at > datetime('now', '-24 hours');

-- ============================================
-- TRANSACTION STORAGE
-- ============================================

-- Main transaction table
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_hash TEXT NOT NULL,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    block_number INTEGER NOT NULL,
    block_hash TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL, -- ISO 8601 UTC
    -- Transaction parties (string addresses for flexibility)
    from_address TEXT NOT NULL,
    to_address TEXT,
    -- Amounts (strings for precision)
    value TEXT NOT NULL, -- Native token amount
    fee TEXT NOT NULL, -- Transaction fee paid
    tip TEXT, -- Optional tip for validators
    gas_used INTEGER, -- For EVM chains
    gas_price TEXT, -- For EVM chains
    -- Transaction classification (blockchain level)
    transaction_type TEXT NOT NULL CHECK(transaction_type IN (
        'transfer', 'stake', 'unstake', 'bond', 'unbond', 'nominate',
        'reward', 'xcm', 'swap', 'liquidity', 'governance', 'utility',
        'contract_call', 'contract_deploy', 'other'
    )),
    transaction_subtype TEXT, -- More specific categorization
    -- GAAP/IFRS categorization (links to comprehensive transaction-categories.ts)
    basic_transaction_type TEXT CHECK(basic_transaction_type IN (
        'purchase', 'sale', 'transfer_in', 'transfer_out', 'stake', 'unstake',
        'reward', 'fee', 'swap_in', 'swap_out', 'lp_deposit', 'lp_withdraw',
        'airdrop', 'gift_received', 'gift_sent', 'donation', 'other'
    )),
    gaap_category TEXT, -- From TransactionCategory enum
    gaap_subcategory TEXT,
    gaap_type_code TEXT, -- From transaction code (e.g., 'ACQ_FIAT_CRYPTO')
    -- Status
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending')),
    error_message TEXT,
    -- Substrate specific
    extrinsic_index INTEGER, -- Position in block
    pallet_name TEXT, -- Which pallet was called
    method_name TEXT, -- Which method was called
    -- Cross-chain
    is_xcm BOOLEAN DEFAULT FALSE,
    xcm_message_hash TEXT,
    xcm_destination_chain_id INTEGER REFERENCES chains(id) ON DELETE SET NULL,
    -- Data storage
    raw_data JSON CHECK(json_valid(raw_data)), -- Complete transaction data
    parsed_data JSON CHECK(json_valid(parsed_data)), -- Structured extraction
    notes TEXT, -- User annotations
    -- Audit
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reconciled_at TIMESTAMP,
    UNIQUE(chain_id, transaction_hash)
);

CREATE INDEX idx_transactions_hash ON transactions(transaction_hash);
CREATE INDEX idx_transactions_block ON transactions(chain_id, block_number);
CREATE INDEX idx_transactions_from ON transactions(from_address, timestamp DESC);
CREATE INDEX idx_transactions_to ON transactions(to_address, timestamp DESC);
CREATE INDEX idx_transactions_from_to ON transactions(from_address, to_address, timestamp DESC);
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_type ON transactions(transaction_type, chain_id);
CREATE INDEX idx_transactions_gaap ON transactions(gaap_type_code) WHERE gaap_type_code IS NOT NULL;

-- Junction table: Links accounts to transactions they're involved in
CREATE TABLE account_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    direction TEXT NOT NULL CHECK(direction IN ('from', 'to', 'both', 'internal')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, transaction_id)
);

CREATE INDEX idx_account_txns_lookup ON account_transactions(account_id, transaction_id);
CREATE INDEX idx_account_txns_account ON account_transactions(account_id);

-- Transaction events (multiple per transaction)
CREATE TABLE transaction_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    event_index INTEGER NOT NULL, -- Order within transaction
    event_type TEXT NOT NULL, -- 'transfer', 'approval', 'mint', 'burn', etc.
    -- Event parties
    from_address TEXT,
    to_address TEXT,
    -- Asset movement
    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    amount TEXT, -- String for precision
    -- Event specific data
    pallet_name TEXT, -- Substrate
    event_name TEXT, -- Substrate
    topics JSON, -- EVM event topics
    data JSON CHECK(json_valid(data)), -- Parsed event data
    raw_data JSON CHECK(json_valid(raw_data)), -- Original event data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, event_index)
);

CREATE INDEX idx_transaction_events_tx ON transaction_events(transaction_id);
CREATE INDEX idx_transaction_events_asset ON transaction_events(asset_id) WHERE asset_id IS NOT NULL;
CREATE INDEX idx_transaction_events_type ON transaction_events(event_type);

-- Token transfers (normalized view derived from events)
CREATE TABLE token_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Link to either transaction or event (not both)
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    event_id INTEGER REFERENCES transaction_events(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount TEXT NOT NULL, -- String for precision
    amount_usd TEXT, -- USD value at time of transfer
    timestamp TIMESTAMP NOT NULL,
    transfer_type TEXT CHECK(transfer_type IN (
        'payment', 'deposit', 'withdrawal', 'swap', 'bridge',
        'reward', 'fee', 'mint', 'burn', 'other'
    )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Ensure only one link is set
    CHECK((transaction_id IS NOT NULL AND event_id IS NULL) OR
          (transaction_id IS NULL AND event_id IS NOT NULL))
);

CREATE INDEX idx_token_transfers_from ON token_transfers(from_address, timestamp DESC);
CREATE INDEX idx_token_transfers_to ON token_transfers(to_address, timestamp DESC);
CREATE INDEX idx_token_transfers_asset ON token_transfers(asset_id, timestamp DESC);
CREATE INDEX idx_token_transfers_timestamp ON token_transfers(timestamp DESC);

-- ============================================
-- STAKING AND DEFI
-- ============================================

-- Staking positions
CREATE TABLE staking_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    staking_type TEXT NOT NULL CHECK(staking_type IN (
        'nominated', 'validated', 'pooled', 'liquid', 'parachain'
    )),
    validator_address TEXT,
    pool_id INTEGER,
    amount_staked TEXT NOT NULL,
    amount_locked TEXT, -- Locked portion
    amount_unlocking TEXT, -- Currently unbonding
    unlock_date TIMESTAMP,
    last_reward_block INTEGER,
    last_reward_at TIMESTAMP,
    total_rewards_earned TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    opened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staking_positions_account ON staking_positions(account_id, is_active);
CREATE INDEX idx_staking_positions_chain ON staking_positions(chain_id, is_active);
CREATE INDEX idx_staking_positions_validator ON staking_positions(validator_address) WHERE validator_address IS NOT NULL;

-- Staking rewards tracking
CREATE TABLE staking_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    position_id INTEGER NOT NULL REFERENCES staking_positions(id) ON DELETE CASCADE,
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    era_index INTEGER, -- Substrate era
    epoch_number INTEGER, -- Alternative epoch system
    amount TEXT NOT NULL,
    amount_usd TEXT,
    timestamp TIMESTAMP NOT NULL,
    reward_type TEXT CHECK(reward_type IN (
        'staking', 'commission', 'nomination_pool', 'parachain', 'slash'
    )),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staking_rewards_position ON staking_rewards(position_id, timestamp DESC);
CREATE INDEX idx_staking_rewards_timestamp ON staking_rewards(timestamp DESC);

-- DeFi positions (LP, lending, etc.)
CREATE TABLE defi_positions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    protocol_name TEXT NOT NULL, -- 'Acala DEX', 'Moonwell', 'StellaSwap', etc.
    position_type TEXT NOT NULL CHECK(position_type IN (
        'liquidity_pool', 'lending', 'borrowing', 'farming', 'vault', 'other'
    )),
    pool_address TEXT,
    pool_name TEXT,
    -- LP specific
    token0_id INTEGER REFERENCES assets(id),
    token1_id INTEGER REFERENCES assets(id),
    lp_token_id INTEGER REFERENCES assets(id),
    amount_token0 TEXT,
    amount_token1 TEXT,
    lp_tokens TEXT,
    -- Values
    position_value_usd TEXT,
    cost_basis_usd TEXT,
    impermanent_loss_usd TEXT,
    total_rewards_earned_usd TEXT,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    opened_at TIMESTAMP,
    opened_transaction_id INTEGER REFERENCES transactions(id),
    closed_at TIMESTAMP,
    closed_transaction_id INTEGER REFERENCES transactions(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_defi_positions_account ON defi_positions(account_id, is_active);
CREATE INDEX idx_defi_positions_chain ON defi_positions(chain_id, protocol_name, is_active);
CREATE INDEX idx_defi_positions_type ON defi_positions(position_type, is_active);

-- ============================================
-- BALANCES AND RECONCILIATION
-- ============================================

-- Current account balances (denormalized for performance)
CREATE TABLE account_balances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    -- Balances (all stored as strings for precision)
    free_balance TEXT NOT NULL DEFAULT '0', -- Available balance
    reserved_balance TEXT NOT NULL DEFAULT '0', -- Reserved/locked
    misc_frozen_balance TEXT NOT NULL DEFAULT '0', -- Misc frozen (Substrate)
    fee_frozen_balance TEXT NOT NULL DEFAULT '0', -- Fee frozen (Substrate)
    -- Note: total_balance is computed, not stored
    -- Calculated fields
    balance_usd TEXT, -- USD value at last update
    -- Tracking
    last_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    last_block_number INTEGER,
    last_updated_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, chain_id, asset_id)
);

CREATE INDEX idx_account_balances_lookup ON account_balances(account_id, chain_id, asset_id);
CREATE INDEX idx_account_balances_account ON account_balances(account_id) WHERE free_balance != '0';
CREATE INDEX idx_account_balances_updated ON account_balances(last_updated_at);

-- View for total balance calculation
CREATE VIEW v_account_balances_with_total AS
SELECT
    *,
    CAST(free_balance AS REAL) +
    CAST(reserved_balance AS REAL) +
    CAST(misc_frozen_balance AS REAL) AS total_balance_numeric
FROM account_balances;

-- Balance snapshots for historical tracking
CREATE TABLE balance_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    balance TEXT NOT NULL,
    balance_usd TEXT,
    block_number INTEGER,
    snapshot_type TEXT DEFAULT 'daily' CHECK(snapshot_type IN (
        'hourly', 'daily', 'weekly', 'monthly', 'manual'
    )),
    snapshot_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, chain_id, asset_id, snapshot_at, snapshot_type)
);

CREATE INDEX idx_balance_snapshots_lookup ON balance_snapshots(account_id, snapshot_at DESC);
CREATE INDEX idx_balance_snapshots_asset ON balance_snapshots(asset_id, snapshot_at DESC);

-- ============================================
-- CROSS-CHAIN (XCM) TRACKING
-- ============================================

-- XCM message tracking
CREATE TABLE xcm_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_hash TEXT UNIQUE NOT NULL,
    -- Source
    source_chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    source_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    source_address TEXT NOT NULL,
    source_block_number INTEGER,
    source_timestamp TIMESTAMP,
    -- Destination
    destination_chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE RESTRICT,
    destination_transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
    destination_address TEXT NOT NULL,
    destination_block_number INTEGER,
    destination_timestamp TIMESTAMP,
    -- Transfer details
    asset_id INTEGER REFERENCES assets(id) ON DELETE SET NULL,
    amount_sent TEXT NOT NULL,
    amount_received TEXT,
    xcm_fee TEXT,
    bridge_fee TEXT,
    -- Status tracking
    status TEXT NOT NULL CHECK(status IN (
        'pending', 'sent', 'received', 'failed', 'timeout', 'cancelled'
    )),
    error_message TEXT,
    -- Metadata
    xcm_version INTEGER,
    instructions JSON CHECK(json_valid(instructions)), -- XCM program
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_xcm_messages_hash ON xcm_messages(message_hash);
CREATE INDEX idx_xcm_messages_source ON xcm_messages(source_chain_id, source_address, source_timestamp DESC);
CREATE INDEX idx_xcm_messages_dest ON xcm_messages(destination_chain_id, destination_address);
CREATE INDEX idx_xcm_messages_status ON xcm_messages(status, created_at DESC);

-- ============================================
-- ACCOUNTING INTEGRATION
-- ============================================

-- Transaction categorization for accounting
CREATE TABLE transaction_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_name TEXT UNIQUE NOT NULL,
    category_type TEXT NOT NULL CHECK(category_type IN (
        'income', 'expense', 'transfer', 'trade', 'fee', 'other'
    )),
    parent_category_id INTEGER REFERENCES transaction_categories(id) ON DELETE SET NULL,
    tax_treatment TEXT CHECK(tax_treatment IN (
        'taxable_income', 'capital_gain', 'capital_loss', 'non_taxable',
        'tax_deductible', 'other'
    )),
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE, -- System categories can't be deleted
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transaction_categories_type ON transaction_categories(category_type, is_active);

-- Manual categorization and adjustments
CREATE TABLE transaction_accounting (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_id INTEGER UNIQUE NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES transaction_categories(id) ON DELETE SET NULL,
    cost_basis_usd TEXT, -- For tax calculations
    proceeds_usd TEXT, -- For sales/trades
    gain_loss_usd TEXT, -- Calculated gain/loss
    -- Accounting specific
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,
    accounting_date DATE, -- May differ from transaction date
    journal_entry_id INTEGER, -- Link to external accounting system
    -- Adjustments
    is_adjusted BOOLEAN DEFAULT FALSE,
    adjustment_reason TEXT,
    original_values JSON CHECK(json_valid(original_values)), -- Store original before adjustment
    -- Review status
    review_status TEXT DEFAULT 'pending' CHECK(review_status IN (
        'pending', 'reviewed', 'approved', 'rejected'
    )),
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transaction_accounting_tx ON transaction_accounting(transaction_id);
CREATE INDEX idx_transaction_accounting_category ON transaction_accounting(category_id);
CREATE INDEX idx_transaction_accounting_date ON transaction_accounting(accounting_date);
CREATE INDEX idx_transaction_accounting_review ON transaction_accounting(review_status);

-- ============================================
-- SYNC AND AUDIT TABLES
-- ============================================

-- Sync status tracking
CREATE TABLE sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    chain_id INTEGER NOT NULL REFERENCES chains(id) ON DELETE CASCADE,
    sync_type TEXT NOT NULL CHECK(sync_type IN (
        'full', 'incremental', 'realtime', 'historical'
    )),
    last_synced_block INTEGER,
    last_synced_at TIMESTAMP,
    next_sync_at TIMESTAMP,
    sync_errors INTEGER DEFAULT 0,
    last_error TEXT,
    last_error_at TIMESTAMP,
    is_syncing BOOLEAN DEFAULT FALSE,
    sync_progress_pct REAL, -- 0-100
    estimated_completion_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(account_id, chain_id)
);

CREATE INDEX idx_sync_status_lookup ON sync_status(account_id, chain_id);
CREATE INDEX idx_sync_status_next ON sync_status(next_sync_at) WHERE is_syncing = FALSE;
CREATE INDEX idx_sync_status_syncing ON sync_status(is_syncing, chain_id);

-- Audit log for all changes
CREATE TABLE audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSON CHECK(json_valid(old_values)),
    new_values JSON CHECK(json_valid(new_values)),
    changed_by TEXT, -- User or system identifier
    change_reason TEXT,
    ip_address TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Comprehensive account portfolio view
CREATE VIEW v_account_portfolio AS
SELECT
    a.id as account_id,
    a.account_name,
    a.account_address,
    a.account_format,
    w.wallet_name,
    wp.provider_name,
    c.chain_name,
    c.chain_type,
    ast.symbol,
    ast.name as asset_name,
    ab.free_balance,
    CAST(ab.free_balance AS REAL) +
    CAST(ab.reserved_balance AS REAL) +
    CAST(ab.misc_frozen_balance AS REAL) AS total_balance,
    ab.balance_usd,
    ab.last_updated_at,
    CASE
        WHEN ab.reserved_balance != '0' THEN 'locked'
        ELSE 'available'
    END as balance_status
FROM account_balances ab
JOIN accounts a ON ab.account_id = a.id
JOIN wallets w ON a.wallet_id = w.id
JOIN wallet_providers wp ON w.provider_id = wp.id
JOIN chains c ON ab.chain_id = c.id
JOIN assets ast ON ab.asset_id = ast.id
WHERE ab.free_balance != '0'
  AND a.is_active = TRUE
  AND w.is_active = TRUE;

-- Transaction history with categorization
CREATE VIEW v_transaction_history AS
SELECT
    t.id,
    t.transaction_hash,
    t.timestamp,
    c.chain_name,
    c.chain_type,
    t.from_address,
    t.to_address,
    t.value,
    t.fee,
    t.transaction_type,
    t.basic_transaction_type,
    t.gaap_category,
    t.gaap_type_code,
    t.status,
    tc.category_name as accounting_category,
    tc.category_type,
    tc.tax_treatment,
    ta.cost_basis_usd,
    ta.gain_loss_usd,
    ta.review_status,
    t.reconciled_at IS NOT NULL as is_reconciled
FROM transactions t
JOIN chains c ON t.chain_id = c.id
LEFT JOIN transaction_accounting ta ON t.id = ta.transaction_id
LEFT JOIN transaction_categories tc ON ta.category_id = tc.id
ORDER BY t.timestamp DESC;

-- XCM transfer status view with timeout detection
CREATE VIEW v_xcm_transfers AS
SELECT
    xm.id,
    xm.message_hash,
    sc.chain_name as source_chain,
    dc.chain_name as destination_chain,
    xm.source_address,
    xm.destination_address,
    a.symbol as asset_symbol,
    xm.amount_sent,
    xm.amount_received,
    xm.xcm_fee,
    xm.source_timestamp,
    xm.destination_timestamp,
    CASE
        WHEN xm.status = 'received' THEN 'Complete'
        WHEN xm.status = 'failed' THEN 'Failed'
        WHEN xm.status = 'sent' AND (julianday('now') - julianday(xm.source_timestamp)) > 1 THEN 'Timeout'
        WHEN xm.status = 'pending' THEN 'Pending'
        ELSE xm.status
    END as display_status,
    CAST((julianday(xm.destination_timestamp) - julianday(xm.source_timestamp)) * 24 * 60 AS INTEGER) as transfer_time_minutes
FROM xcm_messages xm
JOIN chains sc ON xm.source_chain_id = sc.id
JOIN chains dc ON xm.destination_chain_id = dc.id
LEFT JOIN assets a ON xm.asset_id = a.id;

-- Active staking positions with returns
CREATE VIEW v_staking_positions AS
SELECT
    sp.id,
    a.account_address,
    a.account_name,
    c.chain_name,
    sp.staking_type,
    sp.validator_address,
    sp.amount_staked,
    sp.total_rewards_earned,
    CASE
        WHEN sp.amount_staked != '0' THEN
            CAST(sp.total_rewards_earned AS REAL) / CAST(sp.amount_staked AS REAL) * 100
        ELSE 0
    END as return_pct,
    sp.last_reward_at,
    sp.opened_at,
    CAST((julianday('now') - julianday(sp.opened_at)) AS INTEGER) as days_staked
FROM staking_positions sp
JOIN accounts a ON sp.account_id = a.id
JOIN chains c ON sp.chain_id = c.id
WHERE sp.is_active = TRUE;

-- Active DeFi positions with P&L
CREATE VIEW v_defi_positions AS
SELECT
    dp.id,
    a.account_address,
    c.chain_name,
    dp.protocol_name,
    dp.position_type,
    t0.symbol as token0_symbol,
    t1.symbol as token1_symbol,
    dp.amount_token0,
    dp.amount_token1,
    dp.position_value_usd,
    dp.cost_basis_usd,
    CAST(dp.position_value_usd AS REAL) - CAST(dp.cost_basis_usd AS REAL) as unrealized_pnl_usd,
    dp.impermanent_loss_usd,
    dp.total_rewards_earned_usd,
    dp.opened_at,
    CAST((julianday('now') - julianday(dp.opened_at)) AS INTEGER) as days_open
FROM defi_positions dp
JOIN accounts a ON dp.account_id = a.id
JOIN chains c ON dp.chain_id = c.id
LEFT JOIN assets t0 ON dp.token0_id = t0.id
LEFT JOIN assets t1 ON dp.token1_id = t1.id
WHERE dp.is_active = TRUE;

-- Wallet connection summary
CREATE VIEW v_wallet_summary AS
SELECT
    w.id as wallet_id,
    w.wallet_name,
    w.wallet_type,
    wp.provider_name,
    COUNT(DISTINCT a.id) as account_count,
    COUNT(DISTINCT ac.chain_id) as chain_count,
    w.last_connected_at,
    w.last_sync_at,
    CASE
        WHEN ws.session_token IS NOT NULL AND ws.expires_at > datetime('now') THEN TRUE
        ELSE FALSE
    END as is_currently_connected
FROM wallets w
JOIN wallet_providers wp ON w.provider_id = wp.id
LEFT JOIN accounts a ON w.id = a.wallet_id AND a.is_active = TRUE
LEFT JOIN account_chains ac ON a.id = ac.account_id AND ac.is_active = TRUE
LEFT JOIN wallet_sessions ws ON w.id = ws.wallet_id AND ws.is_active = TRUE
WHERE w.is_active = TRUE AND w.archived_at IS NULL
GROUP BY w.id;

-- ============================================
-- TRIGGERS
-- ============================================

-- Update timestamps on wallet changes
CREATE TRIGGER update_wallet_timestamp
AFTER UPDATE ON wallets
FOR EACH ROW
BEGIN
    UPDATE wallets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update timestamps on account changes
CREATE TRIGGER update_account_timestamp
AFTER UPDATE ON accounts
FOR EACH ROW
BEGIN
    UPDATE accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Validate asset_uid format on insert
CREATE TRIGGER validate_asset_uid_insert
BEFORE INSERT ON assets
FOR EACH ROW
BEGIN
    SELECT CASE
        WHEN NEW.asset_uid NOT GLOB '*:*:*' THEN
            RAISE(ABORT, 'asset_uid must follow format: chain_id:type:identifier')
    END;
END;

-- Auto-populate chain_specific_address in account_chains if NULL
CREATE TRIGGER populate_chain_address
AFTER INSERT ON account_chains
FOR EACH ROW
WHEN NEW.chain_specific_address IS NULL
BEGIN
    UPDATE account_chains
    SET chain_specific_address = (SELECT account_address FROM accounts WHERE id = NEW.account_id)
    WHERE id = NEW.id;
END;

-- Expire old wallet sessions automatically
CREATE TRIGGER expire_wallet_sessions
AFTER INSERT ON wallet_sessions
BEGIN
    UPDATE wallet_sessions
    SET is_active = FALSE
    WHERE expires_at < datetime('now') AND is_active = TRUE;
END;

-- Track RPC health consecutive failures
CREATE TRIGGER track_rpc_failures
AFTER UPDATE ON rpc_endpoint_health
FOR EACH ROW
WHEN NEW.is_available = FALSE AND OLD.is_available = TRUE
BEGIN
    UPDATE rpc_endpoint_health
    SET consecutive_failures = consecutive_failures + 1
    WHERE id = NEW.id;
END;

-- Reset consecutive failures on success
CREATE TRIGGER reset_rpc_failures
AFTER UPDATE ON rpc_endpoint_health
FOR EACH ROW
WHEN NEW.is_available = TRUE AND OLD.is_available = FALSE
BEGIN
    UPDATE rpc_endpoint_health
    SET consecutive_failures = 0, last_success_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- ============================================
-- INITIAL DATA SEEDING
-- ============================================

-- Seed common chains
INSERT INTO chains (chain_id, chain_name, chain_type, ss58_prefix, native_token_symbol, native_token_decimals, rpc_endpoints, is_active) VALUES
    ('polkadot', 'Polkadot', 'relay', 0, 'DOT', 10, '[{"url": "wss://rpc.polkadot.io", "priority": 1, "is_active": true}]', TRUE),
    ('kusama', 'Kusama', 'relay', 2, 'KSM', 12, '[{"url": "wss://kusama-rpc.polkadot.io", "priority": 1, "is_active": true}]', TRUE),
    ('moonbeam', 'Moonbeam', 'parachain', 1284, 'GLMR', 18, '[{"url": "wss://wss.api.moonbeam.network", "priority": 1, "is_active": true}]', TRUE),
    ('moonriver', 'Moonriver', 'parachain', 1285, 'MOVR', 18, '[{"url": "wss://wss.api.moonriver.moonbeam.network", "priority": 1, "is_active": true}]', TRUE),
    ('astar', 'Astar', 'parachain', 5, 'ASTR', 18, '[{"url": "wss://rpc.astar.network", "priority": 1, "is_active": true}]', TRUE);

-- Update parent chain relationships
UPDATE chains SET parent_chain_id = (SELECT id FROM chains WHERE chain_id = 'polkadot')
WHERE chain_id IN ('moonbeam', 'astar');

UPDATE chains SET parent_chain_id = (SELECT id FROM chains WHERE chain_id = 'kusama')
WHERE chain_id = 'moonriver';

-- Seed native assets
INSERT INTO assets (asset_uid, chain_id, asset_type, symbol, name, decimals, is_verified, is_active) VALUES
    ('polkadot:native:DOT', (SELECT id FROM chains WHERE chain_id = 'polkadot'), 'native', 'DOT', 'Polkadot', 10, TRUE, TRUE),
    ('kusama:native:KSM', (SELECT id FROM chains WHERE chain_id = 'kusama'), 'native', 'KSM', 'Kusama', 12, TRUE, TRUE),
    ('moonbeam:native:GLMR', (SELECT id FROM chains WHERE chain_id = 'moonbeam'), 'native', 'GLMR', 'Glimmer', 18, TRUE, TRUE),
    ('moonriver:native:MOVR', (SELECT id FROM chains WHERE chain_id = 'moonriver'), 'native', 'MOVR', 'Moonriver', 18, TRUE, TRUE),
    ('astar:native:ASTR', (SELECT id FROM chains WHERE chain_id = 'astar'), 'native', 'ASTR', 'Astar', 18, TRUE, TRUE);

-- Seed common transaction categories
INSERT INTO transaction_categories (category_name, category_type, tax_treatment, is_system, description) VALUES
    ('Income - Staking Rewards', 'income', 'taxable_income', TRUE, 'Rewards from staking activities'),
    ('Income - Airdrop', 'income', 'taxable_income', TRUE, 'Free tokens received from airdrops'),
    ('Income - DeFi Yield', 'income', 'taxable_income', TRUE, 'Yield from DeFi protocols'),
    ('Expense - Transaction Fees', 'expense', 'tax_deductible', TRUE, 'Gas and transaction fees'),
    ('Expense - Bridge Fees', 'expense', 'tax_deductible', TRUE, 'Fees paid for cross-chain transfers'),
    ('Transfer - Internal', 'transfer', 'non_taxable', TRUE, 'Transfers between own wallets'),
    ('Transfer - External', 'transfer', 'non_taxable', TRUE, 'Transfers to external parties'),
    ('Trade - Swap', 'trade', 'capital_gain', TRUE, 'Token swaps on DEXs'),
    ('Trade - Buy', 'trade', 'capital_gain', TRUE, 'Purchase of cryptocurrency'),
    ('Trade - Sell', 'trade', 'capital_gain', TRUE, 'Sale of cryptocurrency');

-- ============================================
-- COMPLETION
-- ============================================

-- Update migration record with completion time
UPDATE schema_migrations
SET execution_time_ms = 0 -- Will be updated by migration runner
WHERE version = 1;

-- Verify foreign key constraints are enabled
PRAGMA foreign_key_check;

-- Analyze tables for query optimization
ANALYZE;
