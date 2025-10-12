const XLSX = require('xlsx');
const path = require('path');

const usGaapFile = path.join(__dirname, '../src/data/chart-of-accounts/charts_of_accounts_with_defi.xlsx');
const ifrsFile = path.join(__dirname, '../src/data/chart-of-accounts/charts_of_accounts_IFRS_DeFi.xlsx');

console.log('=== US GAAP File ===');
try {
  const workbook = XLSX.readFile(usGaapFile);
  console.log('Sheet Names:', workbook.SheetNames);

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log('Rows:', data.length);
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      console.log('First data row:', data[1]);
      console.log('Sample rows (first 3):');
      data.slice(0, 4).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
      });
    }
  });
} catch (error) {
  console.error('Error reading US GAAP file:', error.message);
}

console.log('\n\n=== IFRS File ===');
try {
  const workbook = XLSX.readFile(ifrsFile);
  console.log('Sheet Names:', workbook.SheetNames);

  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n--- Sheet: ${sheetName} ---`);
    console.log('Rows:', data.length);
    if (data.length > 0) {
      console.log('Headers:', data[0]);
      console.log('First data row:', data[1]);
      console.log('Sample rows (first 3):');
      data.slice(0, 4).forEach((row, idx) => {
        console.log(`Row ${idx}:`, row);
      });
    }
  });
} catch (error) {
  console.error('Error reading IFRS file:', error.message);
}
