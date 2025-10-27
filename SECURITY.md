# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

The Pacioli team takes security issues seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

### How to Report a Security Vulnerability

**Please DO NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

#### 1. GitHub Security Advisories (Preferred)

Report vulnerabilities privately through GitHub Security Advisories:
1. Go to https://github.com/GiveProtocol/Pacioli/security/advisories
2. Click "Report a vulnerability"
3. Fill out the form with details about the vulnerability

#### 2. Email

Send an email to: **security@pacioli.io**

Please include the following information:

- **Type of issue** (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- **Full paths** of source file(s) related to the manifestation of the issue
- **Location** of the affected source code (tag/branch/commit or direct URL)
- **Step-by-step instructions** to reproduce the issue
- **Proof-of-concept or exploit code** (if possible)
- **Impact** of the issue, including how an attacker might exploit it

### What to Expect

After you submit a vulnerability report, we will:

1. **Acknowledge receipt** within 48 hours
2. **Confirm the vulnerability** and determine its impact
3. **Provide an estimated timeline** for a fix
4. **Keep you updated** on the progress of fixing the vulnerability
5. **Credit you** in the security advisory (unless you prefer to remain anonymous)

### Disclosure Policy

- **Embargo Period**: We ask that you allow us 90 days to investigate and address the vulnerability before public disclosure
- **Coordinated Disclosure**: We believe in coordinated vulnerability disclosure and will work with you on timing
- **Security Advisories**: Once fixed, we'll publish a security advisory on GitHub

### Bug Bounty Program

At this time, Pacioli does not have a paid bug bounty program. However:
- We deeply appreciate security researchers' contributions
- Significant findings will be acknowledged in our security advisories
- We're exploring options for a bug bounty program in the future

## Security Best Practices for Users

### For Self-Hosted Deployments

1. **Keep Software Updated**
   - Always use the latest stable release
   - Subscribe to security advisories on GitHub
   - Enable automatic updates if possible

2. **Secure Your Environment**
   - Use strong passwords for all accounts
   - Enable two-factor authentication (2FA) where supported
   - Keep your operating system and dependencies updated

3. **Database Security**
   - Encrypt your SQLite database at rest
   - Use appropriate file permissions (chmod 600 for database file)
   - Regularly backup your database to a secure location

4. **API Keys and Secrets**
   - Never commit API keys to version control
   - Use environment variables for secrets
   - Rotate API keys regularly
   - Use `.env.local` for local development secrets

5. **Network Security**
   - Run behind a firewall if exposing to network
   - Use HTTPS/TLS for all network communications
   - Consider VPN for remote access

### For Wallet Security

1. **Private Keys**
   - Never share your private keys
   - Store private keys in hardware wallets when possible
   - Use secure key management (like Tauri's secure storage)

2. **Transaction Signing**
   - Always verify transaction details before signing
   - Use hardware wallet signing for large amounts
   - Be cautious of phishing attempts

3. **Backup and Recovery**
   - Securely backup your wallet seed phrases
   - Test your backup and recovery process
   - Store backups in multiple secure locations

## Security Architecture

### Data Protection

- **Local-First**: All financial data is stored locally by default
- **Encryption**: Sensitive data is encrypted using industry-standard algorithms
- **No Cloud by Default**: Free version doesn't transmit data to cloud services

### Code Security

- **Dependency Scanning**: We use Dependabot for automated dependency updates
- **Static Analysis**: Code is analyzed with DeepSource and CodeQL
- **Type Safety**: TypeScript provides compile-time type checking
- **Memory Safety**: Rust provides memory safety guarantees

### Authentication & Authorization

- **No Server Authentication** (self-hosted version): Data remains local
- **Wallet-Based Auth**: Blockchain wallet signatures for identity
- **No Password Storage**: We don't store passwords for the core app

## Security Testing

We perform regular security testing including:

- **Static Application Security Testing (SAST)**: Automated code analysis
- **Dependency Scanning**: Regular checks for vulnerable dependencies
- **Manual Code Review**: Security-focused code reviews for sensitive areas
- **Penetration Testing**: Periodic security audits (roadmap item)

## Known Security Considerations

### Blockchain Interactions

- **Smart Contract Risk**: Interacting with smart contracts carries inherent risks
- **Private Key Management**: Users are responsible for securing their private keys
- **Transaction Finality**: Blockchain transactions are irreversible

### Third-Party Integrations

- **Exchange APIs**: API keys for exchanges should be read-only when possible
- **Price Feeds**: We rely on third-party price data (CoinGecko, etc.)
- **RPC Providers**: Connection to blockchain nodes may expose IP addresses

## Vulnerability Disclosure Timeline

1. **Day 0**: Vulnerability reported to security@pacioli.io
2. **Day 2**: Initial acknowledgment sent to reporter
3. **Day 7**: Vulnerability confirmed and severity assessed
4. **Day 14**: Patch developed and tested internally
5. **Day 21**: Security update released with advisory
6. **Day 90**: Full technical details published (if applicable)

*Timeline may vary based on vulnerability complexity*

## Security Hall of Fame

We'd like to thank the following security researchers for responsibly disclosing vulnerabilities:

<!-- Security researchers will be listed here after verified disclosures -->

*No vulnerabilities reported yet - be the first to help secure Pacioli!*

## Contact

For security-related inquiries:
- **Email**: security@pacioli.io
- **GPG Key**: [Coming soon]
- **GitHub Security**: https://github.com/GiveProtocol/Pacioli/security

For non-security issues, please use:
- **General Support**: support@pacioli.io
- **GitHub Issues**: https://github.com/GiveProtocol/Pacioli/issues

## Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Tauri Security Best Practices](https://tauri.app/v1/references/architecture/security)
- [Rust Security Guidelines](https://anssi-fr.github.io/rust-guide/)

---

**Last Updated**: 2025-10-26

Thank you for helping keep Pacioli and our users safe!
