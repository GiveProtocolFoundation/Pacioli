# Wallet Connection Implementation Plan

## Executive Summary

This plan details the implementation of multi-chain wallet connection functionality for Pacioli, building on the existing foundation. The codebase already has substantial wallet infrastructure for Substrate and EVM chains - this plan focuses on gaps and enhancements needed for the full specification.

---

## Current State Analysis

### What Already Exists

| Component | Status | Location |
|-----------|--------|----------|
| Substrate wallet connection | Complete | `src/services/wallet/walletService.ts` |
| EVM (MetaMask) connection | Complete | `src/services/wallet/walletService.ts` |
| Challenge-based auth | Complete | `src/services/auth/walletAuth.ts` |
| Signature verification (Rust) | Complete | `src-tauri/src/api/wallet_auth.rs` |
| Database schema | Complete | `migrations/001_wallet_system_schema.sql` |
| Wallet UI component | Complete | `src/components/wallet/WalletConnector.tsx` |
| Wallet aliases | Complete | `src/contexts/WalletAliasContext.tsx` |
| Type definitions | Complete | `src/services/wallet/types.ts` |

### What Needs Implementation

| Component | Priority | Effort |
|-----------|----------|--------|
| Bitcoin address validation & signing | High | Medium |
| Solana address validation & signing | High | Medium |
| WalletConnect v2 upgrade | High | Medium |
| Manual address entry flow | High | Low |
| Verification message UI | High | Low |
| Wallet management tab | Medium | Medium |
| Additional EVM L2 chains | Medium | Low |
| Hardware wallet support | Low | High |

---

## Implementation Phases

### Phase 1: Manual Address Entry & Verification UI (Week 1)

**Objective**: Allow users to manually add wallet addresses and verify ownership via message signing.

#### Task 1.1: Create WalletConnectionModal Component

**File**: `src/components/wallet/WalletConnectionModal.tsx`

```
Features:
- Tabbed interface: "Add Wallet" | "WalletConnect" | "Manage Wallets"
- Heritage Elegance styling (burgundy #8B4049, gold #C9A961)
- Responsive design for desktop app
```

**Subtasks**:
- [ ] Create modal shell with tab navigation
- [ ] Implement "Add Wallet" tab with blockchain selector
- [ ] Add address input with real-time validation
- [ ] Add optional label field
- [ ] Create verification message display
- [ ] Add signature input field
- [ ] Implement "Verify Ownership" button with loading state

#### Task 1.2: Blockchain Network Selector

**File**: `src/components/wallet/BlockchainSelector.tsx`

```typescript
// Grouped options structure:
const blockchainGroups = {
  'Substrate Chains': ['polkadot', 'kusama', 'moonbeam', 'astar'],
  'Ethereum & L2s': ['ethereum', 'arbitrum', 'optimism', 'base', 'polygon'],
  'Other Chains': ['bitcoin', 'solana']
};
```

**Subtasks**:
- [ ] Create grouped dropdown component
- [ ] Add chain icons for each network
- [ ] Implement keyboard navigation
- [ ] Add search/filter capability

#### Task 1.3: Address Validation Service

**File**: `src/services/wallet/addressValidation.ts`

```typescript
interface ValidationResult {
  isValid: boolean;
  normalizedAddress: string;
  addressType?: string; // e.g., 'bech32', 'legacy', 'ss58'
  error?: string;
}

function validateAddress(address: string, blockchain: BlockchainType): ValidationResult
```

**Subtasks**:
- [ ] Implement Substrate SS58 validation (existing @polkadot/util-crypto)
- [ ] Implement Ethereum checksum validation (existing ethers)
- [ ] Implement Bitcoin address validation (needs bitcoinjs-lib)
- [ ] Implement Solana address validation (needs @solana/web3.js)
- [ ] Add unit tests for each blockchain type

#### Task 1.4: Verification Message Generator

**File**: `src/services/wallet/verificationMessage.ts`

```typescript
function generateVerificationMessage(
  address: string,
  blockchain: BlockchainType
): { message: string; timestamp: string; nonce: string }
```

**Subtasks**:
- [ ] Create message template with address, timestamp, nonce
- [ ] Format appropriately for each blockchain's signing standard
- [ ] Store pending verifications in local state

---

### Phase 2: Backend Signature Verification (Week 2)

**Objective**: Extend Rust backend to verify signatures from all supported blockchains.

#### Task 2.1: Bitcoin Signature Verification

**File**: `src-tauri/src/api/wallet_auth.rs` (extend)

**Dependencies to add** (Cargo.toml):
```toml
bitcoin = "0.31"
```

**Subtasks**:
- [ ] Add Bitcoin address format validation (P2PKH, P2SH, Bech32, Bech32m)
- [ ] Implement Bitcoin Signed Message verification
- [ ] Add unit tests for Bitcoin signatures
- [ ] Handle different address type derivations

#### Task 2.2: Solana Signature Verification

**File**: `src-tauri/src/api/wallet_auth.rs` (extend)

**Dependencies to add** (Cargo.toml):
```toml
solana-sdk = "1.17"
bs58 = "0.5"
```

**Subtasks**:
- [ ] Add Solana address validation (base58 public key)
- [ ] Implement ED25519 signature verification
- [ ] Add unit tests for Solana signatures

#### Task 2.3: Unified Verification Command

**File**: `src-tauri/src/api/wallet_auth.rs` (extend)

```rust
#[tauri::command]
pub async fn verify_wallet_signature(
    address: String,
    message: String,
    signature: String,
    blockchain_type: String,
) -> Result<VerificationResult, WalletAuthError>
```

**Subtasks**:
- [ ] Create blockchain type dispatcher
- [ ] Implement consistent error handling
- [ ] Add rate limiting for verification attempts
- [ ] Log verification attempts for audit

---

### Phase 3: Frontend-Backend Integration (Week 3)

**Objective**: Connect the UI to backend verification and persist wallets.

#### Task 3.1: Wallet Connection Context Enhancement

**File**: `src/contexts/WalletConnectionContext.tsx` (new)

```typescript
interface WalletConnectionContextType {
  wallets: Wallet[];
  isLoading: boolean;
  error: string | null;

  // Manual flow
  addManualWallet: (address: string, blockchain: string, label?: string) => Promise<Wallet>;
  verifyWallet: (walletId: string, signature: string) => Promise<boolean>;

  // WalletConnect flow
  connectWalletConnect: () => Promise<Wallet[]>;
  disconnectWalletConnect: () => Promise<void>;

  // Management
  removeWallet: (id: string) => Promise<void>;
  updateWalletLabel: (id: string, label: string) => Promise<void>;
  refreshWallets: () => Promise<void>;
}
```

**Subtasks**:
- [ ] Create context provider
- [ ] Implement Tauri invoke calls for each method
- [ ] Add optimistic updates for better UX
- [ ] Implement error recovery

#### Task 3.2: Tauri Command Integration

**File**: `src/services/wallet/walletCommands.ts`

```typescript
// Wrapper functions for Tauri commands
export const walletCommands = {
  addWallet: (address: string, blockchain: string, label?: string) =>
    invoke<Wallet>('add_wallet_address', { address, blockchain, label }),

  verifyWallet: (address: string, signature: string, message: string) =>
    invoke<boolean>('verify_wallet_signature', { address, signature, message }),

  getWallets: () =>
    invoke<Wallet[]>('get_all_wallets'),

  removeWallet: (id: string) =>
    invoke<boolean>('remove_wallet', { id }),
};
```

**Subtasks**:
- [ ] Create typed wrapper functions
- [ ] Add error transformation
- [ ] Implement retry logic for transient failures

#### Task 3.3: Wallet Management UI

**File**: `src/components/wallet/WalletManagementPanel.tsx`

```
Features:
- Table view of all wallets
- Columns: Label, Address (truncated), Network, Status, Actions
- Status badges: Verified (green), Unverified (yellow)
- Actions: Edit label, Remove, Verify (if unverified)
- Search/filter by network
- Summary stats
```

**Subtasks**:
- [ ] Create table component with sorting
- [ ] Implement inline label editing
- [ ] Add confirmation dialog for removal
- [ ] Create verification prompt for unverified wallets
- [ ] Add empty state design

---

### Phase 4: WalletConnect v2 Integration (Week 4)

**Objective**: Implement WalletConnect v2 for mobile wallet connections.

#### Task 4.1: WalletConnect Service Upgrade

**File**: `src/services/wallet/walletConnectService.ts`

**Dependencies**:
```bash
pnpm add @walletconnect/sign-client @walletconnect/modal
```

**Subtasks**:
- [ ] Initialize SignClient with project ID
- [ ] Configure required namespaces (polkadot, eip155, solana)
- [ ] Implement QR code modal display
- [ ] Handle session approval/rejection
- [ ] Extract addresses from session
- [ ] Implement disconnect functionality
- [ ] Add session persistence/restoration

#### Task 4.2: WalletConnect UI Tab

**File**: `src/components/wallet/WalletConnectTab.tsx`

```
Features:
- "Connect Mobile Wallet" button
- QR code display area
- Connection status indicator
- Connected wallet list
- Disconnect button
- Instructions panel
```

**Subtasks**:
- [ ] Create connection initiation UI
- [ ] Implement QR code display
- [ ] Show connection progress states
- [ ] Display connected addresses
- [ ] Add disconnect confirmation

#### Task 4.3: Auto-Save WalletConnect Addresses

**Subtasks**:
- [ ] On successful connection, save all addresses to database
- [ ] Mark as verified (WalletConnect proves ownership)
- [ ] Generate appropriate labels
- [ ] Handle duplicate address detection

---

### Phase 5: User Experience Polish (Week 5)

**Objective**: Refine the UI and add comprehensive help/guidance.

#### Task 5.1: Signing Instructions Component

**File**: `src/components/wallet/SigningInstructions.tsx`

```
Per-blockchain instructions:
- Polkadot: Polkadot.js, SubWallet, Talisman, Nova
- Ethereum: MetaMask, Coinbase Wallet, Rainbow
- Bitcoin: Sparrow, Electrum (note: limited support)
- Solana: Phantom, Solflare
```

**Subtasks**:
- [ ] Create collapsible instruction panels
- [ ] Add wallet-specific screenshots/icons
- [ ] Include "Copy message" button
- [ ] Add external links to wallet documentation

#### Task 5.2: Address Display Component

**File**: `src/components/common/AddressDisplay.tsx`

```typescript
interface AddressDisplayProps {
  address: string;
  blockchain: BlockchainType;
  truncate?: boolean;
  showCopy?: boolean;
  showExplorer?: boolean;
}
```

**Subtasks**:
- [ ] Create truncation with hover to reveal full
- [ ] Add copy-to-clipboard functionality
- [ ] Add blockchain explorer links
- [ ] Style with monospace font

#### Task 5.3: Error Handling & Feedback

**Subtasks**:
- [ ] Create user-friendly error messages
- [ ] Add success animations/toasts
- [ ] Implement form validation feedback
- [ ] Add loading skeletons

#### Task 5.4: Accessibility

**Subtasks**:
- [ ] Add ARIA labels to all interactive elements
- [ ] Ensure keyboard navigation works
- [ ] Test with screen reader
- [ ] Add focus indicators

---

## File Structure

```
src/
├── components/
│   └── wallet/
│       ├── WalletConnectionModal.tsx      # NEW - Main modal
│       ├── WalletConnector.tsx            # EXISTS - Enhance
│       ├── WalletManagementPanel.tsx      # NEW - Manage tab
│       ├── WalletConnectTab.tsx           # NEW - WalletConnect tab
│       ├── BlockchainSelector.tsx         # NEW - Network dropdown
│       ├── SigningInstructions.tsx        # NEW - Help content
│       └── AddressDisplay.tsx             # NEW - Address formatter
│
├── contexts/
│   ├── WalletAliasContext.tsx             # EXISTS - Keep
│   └── WalletConnectionContext.tsx        # NEW - Main context
│
├── services/
│   └── wallet/
│       ├── walletService.ts               # EXISTS - Enhance
│       ├── walletConnectService.ts        # NEW - WalletConnect v2
│       ├── addressValidation.ts           # NEW - Multi-chain validation
│       ├── verificationMessage.ts         # NEW - Message generation
│       ├── walletCommands.ts              # NEW - Tauri wrappers
│       └── types.ts                       # EXISTS - Extend
│
src-tauri/
└── src/
    └── api/
        └── wallet_auth.rs                 # EXISTS - Extend with BTC/SOL
```

---

## Dependencies to Add

### Frontend (package.json)

```json
{
  "dependencies": {
    "@walletconnect/sign-client": "^2.11.0",
    "@walletconnect/modal": "^2.6.0",
    "@solana/web3.js": "^1.87.0",
    "bitcoinjs-lib": "^6.1.0",
    "bs58": "^5.0.0"
  }
}
```

### Backend (Cargo.toml)

```toml
[dependencies]
bitcoin = "0.31"
solana-sdk = "1.17"
bs58 = "0.5"
```

---

## Database Schema Updates

**File**: `migrations/002_wallet_verification.sql`

```sql
-- Add verification fields to existing wallets table if not present
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS verification_signature TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS verification_message TEXT;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS verification_timestamp INTEGER;
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS is_verified INTEGER DEFAULT 0;

-- Add index for verification status
CREATE INDEX IF NOT EXISTS idx_wallets_verified ON wallets(is_verified);

-- Add blockchain_type if using different column name
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS blockchain_type TEXT;
```

---

## Testing Checklist

### Unit Tests

- [ ] Address validation for each blockchain type
- [ ] Signature verification for each blockchain type
- [ ] Message generation format
- [ ] Tauri command error handling

### Integration Tests

- [ ] Full manual verification flow (Substrate)
- [ ] Full manual verification flow (Ethereum)
- [ ] Full manual verification flow (Bitcoin)
- [ ] Full manual verification flow (Solana)
- [ ] WalletConnect connection flow
- [ ] Wallet persistence across app restart
- [ ] Duplicate address handling

### E2E Tests

- [ ] Add wallet via manual entry
- [ ] Verify wallet ownership
- [ ] Connect via WalletConnect
- [ ] Edit wallet label
- [ ] Remove wallet
- [ ] Filter wallets by network

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Bitcoin signing support limited | Provide clear guidance on supported wallets; focus on address validation for MVP |
| WalletConnect project ID required | Register at cloud.walletconnect.com; use env variable |
| Solana SDK large bundle size | Consider lazy loading; tree-shake unused modules |
| Hardware wallet complexity | Defer to Phase 2; focus on software wallets first |

---

## Success Criteria

- [ ] Users can add wallet addresses for all supported blockchains
- [ ] Address validation provides immediate feedback
- [ ] Users can verify ownership via message signing
- [ ] WalletConnect v2 works with mobile wallets
- [ ] All wallets persist in SQLite database
- [ ] Clear visual distinction between verified/unverified
- [ ] UI follows Heritage Elegance design system
- [ ] No private keys stored anywhere
- [ ] All operations work offline (except WalletConnect)

---

## Implementation Order

```
Week 1: Phase 1 (Manual Entry UI)
  ├── Day 1-2: WalletConnectionModal + BlockchainSelector
  ├── Day 3-4: Address validation service
  └── Day 5: Verification message UI

Week 2: Phase 2 (Backend Verification)
  ├── Day 1-2: Bitcoin signature verification
  ├── Day 3-4: Solana signature verification
  └── Day 5: Unified verification command

Week 3: Phase 3 (Integration)
  ├── Day 1-2: WalletConnectionContext
  ├── Day 3-4: Tauri command integration
  └── Day 5: Wallet management panel

Week 4: Phase 4 (WalletConnect)
  ├── Day 1-2: WalletConnect service
  ├── Day 3-4: WalletConnect UI
  └── Day 5: Auto-save and session handling

Week 5: Phase 5 (Polish)
  ├── Day 1-2: Signing instructions
  ├── Day 3: Address display component
  ├── Day 4: Error handling
  └── Day 5: Testing and documentation
```

---

## Next Steps

1. **Approve this plan** - Review and confirm scope
2. **Set up dependencies** - Install required packages
3. **Start Phase 1** - Begin with WalletConnectionModal component
