# Token Lists

This directory contains token lists for supported EVM chains in the Polkadot ecosystem.

## Available Token Lists

- ✅ `moonbeam-tokens.json` - Moonbeam network tokens
- ✅ `moonriver-tokens.json` - Moonriver network tokens
- ✅ `astar-tokens.json` - Astar network tokens

## TODO: Missing Token Lists

- [ ] **Acala EVM+ tokens** - Need to research correct precompile addresses for:
  - ACA (native token)
  - aUSD (Acala USD stablecoin)
  - DOT (Polkadot via XC-20)
  - LDOT (Liquid DOT)
  - Other Acala ecosystem tokens

## Token List Format

Each token list follows this structure:

```json
{
  "name": "Chain Name Token List",
  "tokens": [
    {
      "address": "0x...",
      "symbol": "TOKEN",
      "name": "Token Name",
      "decimals": 18,
      "logoURI": "https://..."
    }
  ]
}
```

## Usage

Token lists are loaded by the EVM indexer to provide metadata for token scanning and balance display.
