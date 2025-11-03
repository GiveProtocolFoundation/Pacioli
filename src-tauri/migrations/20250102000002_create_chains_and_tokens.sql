-- =============================================================================
-- BLOCKCHAIN CHAINS AND TOKENS
-- Enhanced token metadata with chain information and contract addresses
-- =============================================================================

-- Blockchain Chains
CREATE TABLE IF NOT EXISTS chains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chain_id TEXT UNIQUE NOT NULL,
    chain_name TEXT NOT NULL,
    native_token_symbol TEXT,
    chain_type TEXT CHECK(chain_type IN ('relay', 'parachain', 'standalone', 'evm', 'other')),
    rpc_endpoint TEXT,
    block_explorer_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chains_chain_id ON chains(chain_id);
CREATE INDEX IF NOT EXISTS idx_chains_active ON chains(is_active);

-- Tokens/Currencies with detailed metadata
CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    name TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    contract_address TEXT,
    decimals INTEGER NOT NULL DEFAULT 18,
    token_standard TEXT CHECK(token_standard IN (
        'native', 'PSP-22', 'ERC-20', 'ERC-721', 'ERC-1155', 'other'
    )),
    digital_asset_type TEXT NOT NULL CHECK(digital_asset_type IN (
        'Native Protocol Token',
        'Stablecoin',
        'Wrapped/Bridged Token',
        'Liquid Staking Derivative',
        'LP Token',
        'Governance Token',
        'Yield-Bearing Token',
        'NFT - Collectible',
        'NFT - Utility',
        'Synthetic Asset',
        'Other Digital Asset'
    )),
    coingecko_id TEXT,
    icon_url TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chain_id) REFERENCES chains(chain_id),
    UNIQUE(chain_id, contract_address)
);

CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokens_type ON tokens(digital_asset_type);
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);

-- Price History for valuation
CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_id INTEGER NOT NULL,
    price_date DATETIME NOT NULL,
    price_usd DECIMAL(18, 8) NOT NULL,
    source TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (token_id) REFERENCES tokens(id),
    UNIQUE(token_id, price_date)
);

CREATE INDEX IF NOT EXISTS idx_price_token_date ON price_history(token_id, price_date);

-- Wallet Connections
CREATE TABLE IF NOT EXISTS wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_name TEXT,
    wallet_address TEXT NOT NULL,
    chain_id TEXT NOT NULL,
    is_active BOOLEAN DEFAULT 1,
    last_synced DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chain_id) REFERENCES chains(chain_id),
    UNIQUE(wallet_address, chain_id)
);

CREATE INDEX IF NOT EXISTS idx_wallets_address ON wallets(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallets_chain ON wallets(chain_id);
CREATE INDEX IF NOT EXISTS idx_wallets_active ON wallets(is_active);

-- Update triggers
CREATE TRIGGER IF NOT EXISTS chains_update_timestamp
AFTER UPDATE ON chains
BEGIN
    UPDATE chains SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tokens_update_timestamp
AFTER UPDATE ON tokens
BEGIN
    UPDATE tokens SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS wallets_update_timestamp
AFTER UPDATE ON wallets
BEGIN
    UPDATE wallets SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert common chains
INSERT INTO chains (chain_id, chain_name, native_token_symbol, chain_type, is_active) VALUES
    ('polkadot', 'Polkadot', 'DOT', 'relay', 1),
    ('kusama', 'Kusama', 'KSM', 'relay', 1),
    ('moonbeam', 'Moonbeam', 'GLMR', 'parachain', 1),
    ('moonriver', 'Moonriver', 'MOVR', 'parachain', 1),
    ('astar', 'Astar', 'ASTR', 'parachain', 1),
    ('acala', 'Acala', 'ACA', 'parachain', 1),
    ('ethereum', 'Ethereum', 'ETH', 'evm', 1),
    ('polygon', 'Polygon', 'MATIC', 'evm', 1),
    ('arbitrum', 'Arbitrum', 'ETH', 'evm', 1);
