-- =============================================================================
-- ENTITY MANAGEMENT
-- Contacts/Counterparties: Vendors, Customers, and other entities
-- Jurisdiction-agnostic design with flexible tax compliance fields
-- =============================================================================

-- Core entities table (scoped to profiles)
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    profile_id TEXT NOT NULL,

    -- Classification
    entity_type TEXT NOT NULL CHECK (entity_type IN ('vendor', 'customer', 'both', 'other')),

    -- Basic Info
    name TEXT NOT NULL,
    display_name TEXT,

    -- Contact Details
    email TEXT,
    phone TEXT,
    website TEXT,

    -- Address (JSON for international flexibility)
    address TEXT,  -- JSON: { street, city, region, postal_code, country_code }

    -- Primary jurisdiction
    country_code TEXT,  -- ISO 3166-1 alpha-2 (US, GB, DE, etc.)

    -- Tax/Business Identifiers
    tax_identifier TEXT,
    tax_identifier_type TEXT,  -- EIN, VAT, UTR, etc.

    -- Default blockchain address for this entity
    default_wallet_address TEXT,

    -- Categorization
    category TEXT,  -- User-defined: 'contractor', 'supplier', 'exchange', etc.
    tags TEXT,  -- JSON array of tags

    -- Payment defaults
    default_payment_terms INTEGER,  -- Days until payment due
    default_currency TEXT,  -- ISO 4217 currency code

    -- Tax Reporting
    reportable_payee INTEGER DEFAULT 0,  -- Requires tax reporting when paid
    tax_documentation_status TEXT DEFAULT 'none'
        CHECK (tax_documentation_status IN ('none', 'requested', 'received', 'verified', 'expired')),
    tax_documentation_date TEXT,

    -- Jurisdiction-specific metadata (flexible JSON)
    tax_compliance TEXT,  -- JSON for country-specific tax fields

    -- Notes
    notes TEXT,

    -- Metadata
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(profile_id, name, entity_type)
);

CREATE INDEX IF NOT EXISTS idx_entities_profile ON entities(profile_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);
CREATE INDEX IF NOT EXISTS idx_entities_country ON entities(country_code);
CREATE INDEX IF NOT EXISTS idx_entities_category ON entities(category);
CREATE INDEX IF NOT EXISTS idx_entities_active ON entities(is_active);
CREATE INDEX IF NOT EXISTS idx_entities_reportable ON entities(reportable_payee);

-- Entity wallet addresses (multiple addresses per entity)
CREATE TABLE IF NOT EXISTS entity_addresses (
    id TEXT PRIMARY KEY,
    entity_id TEXT NOT NULL,

    address TEXT NOT NULL,
    chain TEXT NOT NULL,  -- 'ethereum', 'polkadot', 'moonbeam', etc.
    address_type TEXT,  -- 'primary', 'treasury', 'hot_wallet', 'cold_storage', etc.
    label TEXT,

    is_verified INTEGER DEFAULT 0,
    verified_at TEXT,
    verification_method TEXT,  -- 'manual', 'on_chain_identity', 'signed_message'

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
    UNIQUE(entity_id, address, chain)
);

CREATE INDEX IF NOT EXISTS idx_entity_addresses_entity ON entity_addresses(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_addresses_lookup ON entity_addresses(address, chain);
CREATE INDEX IF NOT EXISTS idx_entity_addresses_address ON entity_addresses(address);

-- Known/common addresses (global reference data for auto-detection)
-- These are well-known addresses like exchanges, protocols, bridges
CREATE TABLE IF NOT EXISTS known_addresses (
    address TEXT NOT NULL,
    chain TEXT NOT NULL,

    entity_name TEXT NOT NULL,
    entity_type TEXT,  -- 'exchange', 'defi_protocol', 'bridge', 'dao', etc.
    category TEXT,
    subcategory TEXT,

    country_code TEXT,  -- If known
    website TEXT,
    logo_url TEXT,

    confidence TEXT DEFAULT 'high' CHECK (confidence IN ('high', 'medium', 'low')),
    source TEXT,  -- Where this data came from

    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (address, chain)
);

CREATE INDEX IF NOT EXISTS idx_known_addresses_entity ON known_addresses(entity_name);
CREATE INDEX IF NOT EXISTS idx_known_addresses_type ON known_addresses(entity_type);

-- Update trigger for entities
CREATE TRIGGER IF NOT EXISTS entities_update_timestamp
AFTER UPDATE ON entities
BEGIN
    UPDATE entities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Update trigger for known_addresses
CREATE TRIGGER IF NOT EXISTS known_addresses_update_timestamp
AFTER UPDATE ON known_addresses
BEGIN
    UPDATE known_addresses SET updated_at = CURRENT_TIMESTAMP
    WHERE address = NEW.address AND chain = NEW.chain;
END;

-- =============================================================================
-- SEED DATA: Known Addresses (Common Exchanges & Protocols)
-- =============================================================================

-- Major Exchanges (Ethereum mainnet addresses)
INSERT OR IGNORE INTO known_addresses (address, chain, entity_name, entity_type, category, confidence, source) VALUES
-- Binance
('0x28C6c06298d514Db089934071355E5743bf21d60', 'ethereum', 'Binance', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549', 'ethereum', 'Binance', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0xDFd5293D8e347dFe59E90eFd55b2956a1343963d', 'ethereum', 'Binance', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Coinbase
('0x71660c4005BA85c37ccec55d0C4493E66Fe775d3', 'ethereum', 'Coinbase', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0x503828976D22510aad0201ac7EC88293211D23Da', 'ethereum', 'Coinbase', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', 'ethereum', 'Coinbase', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Kraken
('0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2', 'ethereum', 'Kraken', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0x0A869d79a7052C7f1b55a8EbAbbEa3420F0D1E13', 'ethereum', 'Kraken', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Gemini
('0xD24400ae8BfEBb18cA49Be86258a3C749cf46853', 'ethereum', 'Gemini', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
('0x6Fc82a5fe25A5cDb58bc74600A40A69C065263f8', 'ethereum', 'Gemini', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- FTX (for historical reference)
('0x2FAF487A4414Fe77e2327F0bf4AE2a264a776AD2', 'ethereum', 'FTX', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- KuCoin
('0xf16E9B0D03470827A95CDfd0Cb8a8A3b46969B91', 'ethereum', 'KuCoin', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Bitfinex
('0x876EabF441B2EE5B5b0554Fd502a8E0600950cFa', 'ethereum', 'Bitfinex', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- OKX
('0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b', 'ethereum', 'OKX', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Huobi
('0xAb5C66752a9e8167967685F1450532fB96d5d24f', 'ethereum', 'Huobi', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Gate.io
('0x0D0707963952f2fBA59dD06f2b425ace40b492Fe', 'ethereum', 'Gate.io', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- Crypto.com
('0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3', 'ethereum', 'Crypto.com', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels');

-- DeFi Protocols (Ethereum)
INSERT OR IGNORE INTO known_addresses (address, chain, entity_name, entity_type, category, subcategory, confidence, source) VALUES
-- Uniswap
('0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', 'ethereum', 'Uniswap', 'defi_protocol', 'dex', 'router', 'high', 'verified_contract'),
('0xE592427A0AEce92De3Edee1F18E0157C05861564', 'ethereum', 'Uniswap V3', 'defi_protocol', 'dex', 'router', 'high', 'verified_contract'),
('0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', 'ethereum', 'Uniswap V2', 'defi_protocol', 'dex', 'router', 'high', 'verified_contract'),
-- Aave
('0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', 'ethereum', 'Aave V2', 'defi_protocol', 'lending', 'pool', 'high', 'verified_contract'),
('0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', 'ethereum', 'Aave V3', 'defi_protocol', 'lending', 'pool', 'high', 'verified_contract'),
-- Compound
('0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B', 'ethereum', 'Compound', 'defi_protocol', 'lending', 'comptroller', 'high', 'verified_contract'),
-- Curve
('0xD51a44d3FaE010294C616388b506AcdA1bfAAE46', 'ethereum', 'Curve', 'defi_protocol', 'dex', 'pool', 'high', 'verified_contract'),
-- 1inch
('0x1111111254EEB25477B68fb85Ed929f73A960582', 'ethereum', '1inch', 'defi_protocol', 'aggregator', 'router', 'high', 'verified_contract'),
-- Lido
('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', 'ethereum', 'Lido', 'defi_protocol', 'staking', 'stETH', 'high', 'verified_contract'),
-- OpenSea
('0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC', 'ethereum', 'OpenSea', 'defi_protocol', 'nft_marketplace', 'seaport', 'high', 'verified_contract');

-- Bridges
INSERT OR IGNORE INTO known_addresses (address, chain, entity_name, entity_type, category, confidence, source) VALUES
('0x40ec5B33f54e0E8A33A975908C5BA1c14e5BbbDf', 'ethereum', 'Polygon Bridge', 'bridge', 'l2_bridge', 'high', 'verified_contract'),
('0x99C9fc46f92E8a1c0deC1b1747d010903E884bE1', 'ethereum', 'Optimism Bridge', 'bridge', 'l2_bridge', 'high', 'verified_contract'),
('0x4Dbd4fc535Ac27206064B68FfCf827b0A60BAB3f', 'ethereum', 'Arbitrum Bridge', 'bridge', 'l2_bridge', 'high', 'verified_contract');

-- Polkadot Ecosystem
INSERT OR IGNORE INTO known_addresses (address, chain, entity_name, entity_type, category, confidence, source) VALUES
-- Moonbeam
('0x0000000000000000000000000000000000000805', 'moonbeam', 'Moonbeam Staking', 'defi_protocol', 'staking', 'high', 'substrate_precompile'),
('0xF977814e90dA44bFA03b6295A0616a897441aceC', 'moonbeam', 'Binance', 'exchange', 'centralized_exchange', 'high', 'etherscan_labels'),
-- StellaSwap
('0xd0A1E359811322d97991E03f863a0C30C2cF029C', 'moonbeam', 'StellaSwap', 'defi_protocol', 'dex', 'high', 'verified_contract');
