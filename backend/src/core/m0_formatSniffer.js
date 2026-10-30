const XLSX = require('xlsx');

function extractDateString(val) {
  if (!val) return null;
  const str = String(val).trim();
  
  // 1. Matches YYYY-MM-DD or YYYY/MM/DD (e.g. 2026-04-14 00:00:00)
  const mYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (mYMD) return `${mYMD[1]}-${mYMD[2].padStart(2, '0')}-${mYMD[3].padStart(2, '0')}`;

  // 2. Matches DD/MM/YYYY or DD-MM-YYYY (e.g. 14/04/2026)
  const mDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (mDMY) return `${mDMY[3]}-${mDMY[2].padStart(2, '0')}-${mDMY[1].padStart(2, '0')}`;

  // 3. Matches 14-Apr-2026
  const months = { jan:'01', feb:'02', mar:'03', apr:'04', may:'05', jun:'06', jul:'07', aug:'08', sep:'09', oct:'10', nov:'11', dec:'12' };
  const mDMYText = str.match(/^(\d{1,2})[-/]([a-zA-Z]{3})[-/](\d{4})/);
  if (mDMYText) {
    const mm = months[mDMYText[2].toLowerCase()];
    if (mm) return `${mDMYText[3]}-${mm}-${mDMYText[1].padStart(2, '0')}`;
  }

  return null; // If we can't parse it cleanly, drop the row. No guessing.
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
}

function sniffFormat(buffer, expectedType = 'bank') {
  // CRITICAL: Force cellDates to false and raw to false to get text strings
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });

  let headerRowIndex = -1;
  let maxScore = -1;

  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const row = rows[i];
    if (!row || row.length < 3) continue;
    
    let score = 0;
    const rowStr = row.join(' ').toLowerCase();
    
    if (rowStr.includes('date') || rowStr.includes('miti')) score += 5;
    if (rowStr.includes('debit') || rowStr.includes('withdrawal')) score += 4;
    if (rowStr.includes('credit') || rowStr.includes('deposit')) score += 4;
    if (rowStr.includes('balance')) score += 3;
    if (rowStr.includes('particular') || rowStr.includes('desc')) score += 2;

    if (score > maxScore) {
      maxScore = score;
      headerRowIndex = i;
    }
  }

  if (headerRowIndex === -1 || maxScore < 4) {
    headerRowIndex = expectedType === 'ledger' ? 5 : 0;
  }

  const headers = rows[headerRowIndex].map(h => String(h).trim().toLowerCase());
  
  const schema = { headerRowIndex, date: -1, debit: -1, credit: -1, balance: -1, desc: -1, drcr: -1 };

  headers.forEach((h, idx) => {
    if (schema.date === -1 && (h.includes('date') || h.includes('miti'))) schema.date = idx;
    if (schema.debit === -1 && (h.includes('debit') || h.includes('withdrawal'))) schema.debit = idx;
    if (schema.credit === -1 && (h.includes('credit') || h.includes('deposit'))) schema.credit = idx;
    if (schema.balance === -1 && h.includes('balance')) schema.balance = idx;
    if (schema.desc === -1 && (h.includes('particular') || h.includes('desc'))) schema.desc = idx;
    if (schema.drcr === -1 && (h.includes('drcr') || h.includes('type'))) schema.drcr = idx;
  });

  if (expectedType === 'ledger') {
    const dateIdx = headers.findIndex(h => h === 'date' || h.includes('date'));
    if (dateIdx !== -1) schema.date = dateIdx;
    schema.drcr = 2;
    schema.desc = 3;
    schema.debit = 7;
    schema.credit = 8;
  }

  if (schema.debit === -1 && schema.credit === -1) {
    schema.debit = 4; 
    schema.credit = 5;
  }

  return { schema, rows };
}

module.exports = { sniffFormat, extractDateString, addDays };