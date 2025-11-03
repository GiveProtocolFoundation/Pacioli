# Contributing to Pacioli

Thank you for your interest in contributing to Pacioli! We welcome contributions from the community and are excited to have you join us in building the best open-source crypto accounting platform for the Polkadot ecosystem.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** v18+ and **pnpm** package manager
- **Rust** (latest stable version)
- **Git** for version control

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:

```bash
git clone https://github.com/YOUR_USERNAME/Pacioli.git
cd Pacioli
```

3. Add the upstream repository:

```bash
git remote add upstream https://github.com/GiveProtocol/Pacioli.git
```

## Development Setup

1. **Install dependencies:**

```bash
pnpm install
```

2. **Install Rust toolchain and Tauri CLI:**

```bash
# Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Tauri CLI
cargo install tauri-cli
```

3. **Run the development server:**

```bash
pnpm run tauri dev
```

The application will start in development mode with hot-reloading enabled.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear descriptive title**
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Screenshots** if applicable
- **Environment details** (OS, Node version, Rust version, etc.)
- **Relevant logs** or error messages

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) if available.

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear use case** - explain why this enhancement would be useful
- **Detailed description** of the proposed functionality
- **Mockups or examples** if applicable
- **Implementation ideas** (optional)

### Your First Code Contribution

Unsure where to start? Look for issues labeled:

- `good first issue` - suitable for newcomers
- `help wanted` - issues where we need community help
- `documentation` - improvements to docs

### Development Workflow

1. **Create a branch** from `main`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

2. **Make your changes** following our [coding standards](#coding-standards)

3. **Test your changes:**

```bash
# Run tests
pnpm test

# Check linting
pnpm run lint

# Build to ensure no errors
pnpm run build
```

4. **Commit your changes** using conventional commits:

```bash
git commit -m "feat: add support for new blockchain"
# or
git commit -m "fix: resolve transaction parsing error"
```

Commit message prefixes:
- `feat:` - new feature
- `fix:` - bug fix
- `docs:` - documentation changes
- `style:` - code style changes (formatting, etc.)
- `refactor:` - code refactoring
- `test:` - adding or updating tests
- `chore:` - maintenance tasks

5. **Push to your fork:**

```bash
git push origin feature/your-feature-name
```

6. **Open a Pull Request** on GitHub

## Pull Request Process

1. **Ensure your PR:**
   - Has a clear title and description
   - References any related issues (e.g., "Closes #123")
   - Includes tests for new functionality
   - Updates documentation if needed
   - Passes all CI checks

2. **PR Review:**
   - Maintainers will review your PR
   - Address any requested changes
   - Keep the PR focused on a single concern
   - Be responsive to feedback

3. **Merge Requirements:**
   - At least 2 approvals from maintainers
   - All CI checks passing
   - No merge conflicts
   - Up-to-date with `main` branch

4. **After Merge:**
   - Your contribution will be included in the next release
   - You'll be added to the contributors list

## Coding Standards

### TypeScript/React

- Use **TypeScript** for type safety
- Follow **React best practices** and hooks patterns
- Use **functional components** with hooks
- Keep components **small and focused**
- Use **useCallback** and **useMemo** appropriately to prevent unnecessary re-renders

#### Code Style

```typescript
// ✅ Good
interface TransactionProps {
  amount: number
  currency: string
  onConfirm: () => void
}

export const Transaction: React.FC<TransactionProps> = ({
  amount,
  currency,
  onConfirm,
}) => {
  const handleClick = useCallback(() => {
    onConfirm()
  }, [onConfirm])

  return (
    <button onClick={handleClick}>
      {amount} {currency}
    </button>
  )
}

// ❌ Avoid
export default function Transaction(props: any) {
  return <button onClick={() => props.onConfirm()}>{props.amount}</button>
}
```

### Rust

- Follow **Rust naming conventions** (snake_case for functions, PascalCase for types)
- Use **Result<T, E>** for error handling
- Write **idiomatic Rust** code
- Add **doc comments** for public APIs

#### Code Style

```rust
// ✅ Good
/// Fetches transaction data from the blockchain
pub async fn fetch_transaction(tx_hash: &str) -> Result<Transaction, Error> {
    let tx = blockchain_client
        .get_transaction(tx_hash)
        .await
        .map_err(|e| Error::NetworkError(e))?;

    Ok(tx.into())
}

// ❌ Avoid
pub async fn FetchTransaction(TxHash: &str) -> Transaction {
    blockchain_client.get_transaction(TxHash).await.unwrap()
}
```

### Formatting

- **TypeScript/React:** Run `pnpm run format` to format with Prettier
- **Rust:** Run `cargo fmt` to format with rustfmt
- Both are automatically checked in CI

### Linting

- **TypeScript/React:** Run `pnpm run lint` (ESLint)
- **Rust:** Run `cargo clippy` for linting
- Fix all warnings before submitting PR

## Testing Guidelines

### Frontend Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test -- TransactionList.test.tsx
```

### Backend Testing

```bash
# Run Rust tests
cargo test

# Run tests with output
cargo test -- --nocapture

# Run specific test
cargo test test_fetch_transaction
```

### Test Coverage

- Aim for **80%+ code coverage**
- Write **unit tests** for utility functions
- Write **integration tests** for complex workflows
- Test **error cases** and edge conditions

## Documentation

### Code Documentation Standards

All code documentation must follow these standards:

- No emojis in any code-related output (commits, comments, docs, logs)
- Use plain ASCII text for all technical writing
- Keep commit messages in conventional format without decorative elements
- Write clear, professional documentation using only alphanumeric characters and standard punctuation
- Focus on clarity and precision over visual style and verbose description

### Commit Message Format

Use conventional commit format without emojis or decorative symbols:

```
type(scope): description

[optional body]

[optional footer]
```

Examples:
- `feat(navigation): align logo with navigation items`
- `fix(transactions): resolve parsing error for ERC20 transfers`
- `docs(contributing): add documentation standards section`

### Code Comments

- Use plain text only
- Focus on why, not what
- No decorative ASCII art or emojis
- Keep comments concise and technical
- Add **JSDoc comments** for TypeScript functions
- Add **doc comments** for Rust public APIs
- Include **examples** in documentation

### User Documentation

- Update **README.md** if adding new features
- Update **docs/** if changing user-facing functionality
- Add **screenshots** for UI changes
- Use standard markdown without emoji
- Maintain professional tone throughout

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and discussions
- **Community Forum** - https://community.pacioli.io
- **Discord** - Join our developer chat (link in README)

### Getting Help

- Check existing **documentation** first
- Search **closed issues** - your question may have been answered
- Ask in **GitHub Discussions** for general questions
- Use **Issues** for specific bugs or features

### Recognition

Contributors are recognized in:
- **README.md** contributors section
- **Release notes** for significant contributions
- **GitHub insights** for all contributions

## License

By contributing to Pacioli, you agree that your contributions will be licensed under both the MIT License and Apache License 2.0 (dual license), the same licenses as the project.

---

**Thank you for contributing to Pacioli!**

Your time and expertise help make crypto accounting accessible for everyone in the Polkadot ecosystem.
