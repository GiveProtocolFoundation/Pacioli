const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const usGaapFile = path.join(__dirname, '../src/data/chart-of-accounts/charts_of_accounts_with_defi.xlsx');
const ifrsFile = path.join(__dirname, '../src/data/chart-of-accounts/charts_of_accounts_IFRS_DeFi.xlsx');
const outputDir = path.join(__dirname, '../src/data/chart-of-accounts');

function parseSheet(sheet) {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (data.length === 0) return [];

  // Skip headers row (data[0])
  const accounts = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const accountNumber = row[0];
    const accountName = row[1];
    const accountType = row[2];
    const description = row[3];

    // Skip empty rows
    if (!accountNumber && !accountName) continue;

    // Skip header rows (ranges like "1000-1999")
    if (accountNumber && accountNumber.toString().includes('-')) {
      continue;
    }

    // Skip empty account type rows (these are category headers)
    if (!accountType) {
      continue;
    }

    accounts.push({
      code: accountNumber?.toString() || '',
      name: accountName || '',
      type: accountType || '',
      description: description || '',
      isActive: true,
      editable: true
    });
  }

  return accounts;
}

function convertFile(filePath, jurisdiction) {
  console.log(`\nProcessing ${jurisdiction.toUpperCase()} file...`);

  const workbook = XLSX.readFile(filePath);

  const sheetMapping = {
    'Individual Investor': 'individual',
    'Individual Investor - DeFi': 'individual',
    'SME Business': 'sme',
    'SME Business - DeFi': 'sme',
    'Not-for-Profit': 'not-for-profit',
    'Not-for-Profit - DeFi': 'not-for-profit'
  };

  workbook.SheetNames.forEach(sheetName => {
    const accountType = sheetMapping[sheetName];

    if (!accountType) {
      console.log(`  Skipping sheet: ${sheetName} (no mapping)`);
      return;
    }

    console.log(`  Processing sheet: ${sheetName} -> ${accountType}`);

    const sheet = workbook.Sheets[sheetName];
    const accounts = parseSheet(sheet);

    const chartOfAccounts = {
      name: `${jurisdiction.toUpperCase()} - ${accountType.replace('-', ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`,
      jurisdiction,
      accountType,
      accounts,
      isTemplate: true
    };

    const filename = `${jurisdiction}-${accountType}.json`;
    const outputPath = path.join(outputDir, filename);

    fs.writeFileSync(outputPath, JSON.stringify(chartOfAccounts, null, 2));
    console.log(`  ✓ Created: ${filename} (${accounts.length} accounts)`);
  });
}

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Convert both files
try {
  convertFile(usGaapFile, 'us-gaap');
  convertFile(ifrsFile, 'ifrs');
  console.log('\n✓ Conversion complete!');
} catch (error) {
  console.error('Error:', error.message);
  throw error;
}
