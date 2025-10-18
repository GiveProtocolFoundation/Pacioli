---
layout: page
title: API Reference
permalink: /api-reference/
---

# API Reference

Complete API documentation for integrating Numbers with your systems and workflows.

## Getting Started with the API

- [Authentication](/api-reference/authentication/)
- [API Keys](/api-reference/api-keys/)
- [Rate Limits](/api-reference/rate-limits/)
- [Error Handling](/api-reference/errors/)
- [Pagination](/api-reference/pagination/)

## Endpoints

### Organizations
```
GET    /api/v1/organization
PUT    /api/v1/organization
```
- [Get Organization Details](/api-reference/organization-get/)
- [Update Organization](/api-reference/organization-update/)

### Transactions
```
GET    /api/v1/transactions
POST   /api/v1/transactions
GET    /api/v1/transactions/:id
PUT    /api/v1/transactions/:id
DELETE /api/v1/transactions/:id
```
- [List Transactions](/api-reference/transactions-list/)
- [Create Transaction](/api-reference/transactions-create/)
- [Get Transaction](/api-reference/transactions-get/)
- [Update Transaction](/api-reference/transactions-update/)
- [Delete Transaction](/api-reference/transactions-delete/)

### Wallets
```
GET    /api/v1/wallets
POST   /api/v1/wallets
GET    /api/v1/wallets/:id
PUT    /api/v1/wallets/:id
DELETE /api/v1/wallets/:id
GET    /api/v1/wallets/:id/balance
GET    /api/v1/wallets/:id/transactions
```
- [List Wallets](/api-reference/wallets-list/)
- [Add Wallet](/api-reference/wallets-create/)
- [Get Wallet](/api-reference/wallets-get/)
- [Update Wallet](/api-reference/wallets-update/)
- [Remove Wallet](/api-reference/wallets-delete/)
- [Get Wallet Balance](/api-reference/wallets-balance/)
- [Get Wallet Transactions](/api-reference/wallets-transactions/)

### Accounts
```
GET    /api/v1/accounts
POST   /api/v1/accounts
GET    /api/v1/accounts/:id
PUT    /api/v1/accounts/:id
DELETE /api/v1/accounts/:id
```
- [List Accounts](/api-reference/accounts-list/)
- [Create Account](/api-reference/accounts-create/)
- [Get Account](/api-reference/accounts-get/)
- [Update Account](/api-reference/accounts-update/)
- [Delete Account](/api-reference/accounts-delete/)

### Reports
```
GET    /api/v1/reports
POST   /api/v1/reports/generate
GET    /api/v1/reports/:id
GET    /api/v1/reports/:id/download
```
- [List Available Reports](/api-reference/reports-list/)
- [Generate Report](/api-reference/reports-generate/)
- [Get Report Status](/api-reference/reports-status/)
- [Download Report](/api-reference/reports-download/)

### Users
```
GET    /api/v1/users
POST   /api/v1/users
GET    /api/v1/users/:id
PUT    /api/v1/users/:id
DELETE /api/v1/users/:id
```
- [List Users](/api-reference/users-list/)
- [Invite User](/api-reference/users-create/)
- [Get User](/api-reference/users-get/)
- [Update User](/api-reference/users-update/)
- [Remove User](/api-reference/users-delete/)

### Currencies
```
GET    /api/v1/currencies
GET    /api/v1/currencies/rates
GET    /api/v1/currencies/rates/:pair
```
- [List Supported Currencies](/api-reference/currencies-list/)
- [Get Exchange Rates](/api-reference/currencies-rates/)
- [Get Specific Rate](/api-reference/currencies-pair/)

## Webhooks

Configure webhooks to receive real-time notifications:

- [Webhook Setup](/api-reference/webhooks-setup/)
- [Webhook Events](/api-reference/webhooks-events/)
- [Webhook Security](/api-reference/webhooks-security/)
- [Testing Webhooks](/api-reference/webhooks-testing/)

### Available Events
- `transaction.created`
- `transaction.updated`
- `transaction.deleted`
- `wallet.balance_updated`
- `report.generated`
- `user.invited`
- `user.activated`

## SDKs & Libraries

Official SDKs for popular programming languages:

### JavaScript/TypeScript
```bash
npm install @numbers/sdk
```
- [JavaScript SDK Documentation](/api-reference/sdk-javascript/)

### Python
```bash
pip install numbers-sdk
```
- [Python SDK Documentation](/api-reference/sdk-python/)

### Ruby
```bash
gem install numbers-sdk
```
- [Ruby SDK Documentation](/api-reference/sdk-ruby/)

### Go
```bash
go get github.com/numbers/sdk-go
```
- [Go SDK Documentation](/api-reference/sdk-go/)

## Code Examples

### Authentication
```javascript
const Numbers = require('@numbers/sdk');

const client = new Numbers({
  apiKey: 'your_api_key_here',
  environment: 'production' // or 'sandbox'
});
```

### Create Transaction
```javascript
const transaction = await client.transactions.create({
  type: 'crypto_receive',
  cryptocurrency: 'DOT',
  amount: '100.50',
  wallet_id: 'wallet_abc123',
  account_id: 'acc_donations',
  description: 'Donation from supporter',
  date: '2025-10-17T10:30:00Z'
});
```

### List Transactions
```javascript
const transactions = await client.transactions.list({
  limit: 50,
  offset: 0,
  date_from: '2025-10-01',
  date_to: '2025-10-31',
  cryptocurrency: 'DOT'
});
```

### Generate Report
```javascript
const report = await client.reports.generate({
  type: 'balance_sheet',
  date_range: {
    from: '2025-01-01',
    to: '2025-10-31'
  },
  format: 'pdf'
});

// Check status
const status = await client.reports.getStatus(report.id);

// Download when ready
if (status.state === 'completed') {
  const file = await client.reports.download(report.id);
}
```

## API Versions

- **v1** (Current): Stable API with full feature support
- **v2** (Beta): Next-generation API with enhanced features

View the [Changelog](/api-reference/changelog/) for API updates.

## Support

- [API Status Page](https://status.numbers.example.org)
- [Report API Issues](https://github.com/numbers/api/issues)
- [API Community Forum](https://community.numbers.example.org/c/api)
- [Email Support](mailto:api@numbers.example.org)

---

**Ready to integrate?** Get your [API key](/api-reference/api-keys/) and start building!
