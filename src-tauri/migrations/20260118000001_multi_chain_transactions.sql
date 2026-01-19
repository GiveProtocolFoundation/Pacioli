-- =============================================================================
-- MULTI-CHAIN TRANSACTION STORAGE
-- Unified transaction storage for EVM, Substrate, Solana, and Bitcoin chains
-- =============================================================================

-- Multi-chain transactions table
-- Stores transactions from all supported blockchains
CREATE TABLE IF NOT EXISTS multi_chain_transactions (
    -- Composite primary key: chain_id + "_" + hash
    id TEXT PRIMARY KEY,
    chain_id TEXT NOT NULL,
    hash TEXT NOT NULL,
    from_address TEXT NOT NULL,
    to_address TEXT,
    -- Store as string to preserve full precision for large values
    value TEXT NOT NULL,
    fee TEXT,
    -- Unix timestamp
    timestamp INTEGER NOT NULL,
    block_number INTEGER,
    -- Transaction type classification
    tx_type TEXT NOT NULL CHECK(tx_type IN (
        'transfer', 'swap', 'bridge', 'stake', 'unstake',
        'claim', 'mint', 'burn', 'approve', 'contract_call', 'unknown'
    )),
    -- Transaction status
    status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'pending')),
    -- Raw transaction data as JSON
    raw_data TEXT,
    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    -- Ensure unique transactions per chain
    UNIQUE(chain_id, hash)
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_mct_chain_from
    ON multi_chain_transactions(chain_id, from_address);
CREATE INDEX IF NOT EXISTS idx_mct_chain_to
    ON multi_chain_transactions(chain_id, to_address);
CREATE INDEX IF NOT EXISTS idx_mct_timestamp
    ON multi_chain_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mct_chain_timestamp
    ON multi_chain_transactions(chain_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mct_status
    ON multi_chain_transactions(status);

-- Token transfers table
-- Stores ERC20/ERC721/ERC1155/PSP22 token transfers within transactions
CREATE TABLE IF NOT EXISTS token_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- Reference to parent transaction
    transaction_id TEXT NOT NULL REFERENCES multi_chain_transactions(id) ON DELETE CASCADE,
    -- Token contract address
    contract_address TEXT NOT NULL,
    -- Token metadata (may be null if unknown)
    token_symbol TEXT,
    token_name TEXT,
    token_decimals INTEGER,
    -- Transfer details
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    -- Value as string for precision
    value TEXT NOT NULL,
    -- Position in transaction logs
    log_index INTEGER,
    -- Token standard
    token_type TEXT CHECK(token_type IN ('erc20', 'erc721', 'erc1155', 'psp22', 'psp34', 'native', 'unknown')),
    -- NFT token ID (for ERC721/ERC1155)
    token_id TEXT,
    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

-- Indexes for token transfer queries
CREATE INDEX IF NOT EXISTS idx_tt_transaction
    ON token_transfers(transaction_id);
CREATE INDEX IF NOT EXISTS idx_tt_contract
    ON token_transfers(contract_address);
CREATE INDEX IF NOT EXISTS idx_tt_from
    ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_tt_to
    ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_tt_token_type
    ON token_transfers(token_type);

-- Address sync status table
-- Tracks synchronization progress per chain/address pair
CREATE TABLE IF NOT EXISTS address_sync_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT NOT NULL,
    address TEXT NOT NULL,
    -- Last successfully synced block
    last_block_synced INTEGER DEFAULT 0,
    -- Unix timestamp of last sync
    last_sync_timestamp INTEGER,
    -- Sync state
    sync_state TEXT DEFAULT 'idle' CHECK(sync_state IN ('idle', 'syncing', 'error')),
    error_message TEXT,
    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    -- One sync status per chain/address pair
    UNIQUE(chain_id, address)
);

CREATE INDEX IF NOT EXISTS idx_ass_chain
    ON address_sync_status(chain_id);
CREATE INDEX IF NOT EXISTS idx_ass_address
    ON address_sync_status(address);

-- User wallets table
-- Stores user's wallet addresses for tracking
CREATE TABLE IF NOT EXISTS user_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    address TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    -- User-provided label
    label TEXT,
    -- Wallet family type
    wallet_type TEXT NOT NULL CHECK(wallet_type IN ('evm', 'substrate', 'solana', 'bitcoin')),
    -- Watch-only vs connected wallet
    is_watch_only INTEGER DEFAULT 1,
    -- Optional profile association
    profile_id TEXT,
    -- Timestamps
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now')),
    -- One wallet per chain/address pair
    UNIQUE(chain_id, address)
);

CREATE INDEX IF NOT EXISTS idx_uw_address
    ON user_wallets(address);
CREATE INDEX IF NOT EXISTS idx_uw_chain
    ON user_wallets(chain_id);
CREATE INDEX IF NOT EXISTS idx_uw_type
    ON user_wallets(wallet_type);
CREATE INDEX IF NOT EXISTS idx_uw_profile
    ON user_wallets(profile_id);

-- Update timestamp triggers
CREATE TRIGGER IF NOT EXISTS mct_update_timestamp
AFTER UPDATE ON multi_chain_transactions
BEGIN
    UPDATE multi_chain_transactions
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS ass_update_timestamp
AFTER UPDATE ON address_sync_status
BEGIN
    UPDATE address_sync_status
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS uw_update_timestamp
AFTER UPDATE ON user_wallets
BEGIN
    UPDATE user_wallets
    SET updated_at = strftime('%s', 'now')
    WHERE id = NEW.id;
END;
