const { sniffFormat, extractDateString } = require('./m0_formatSniffer');
const { normaliseLedgerSign } = require('./m5_signNormaliser');
const Decimal = require('decimal.js');

function determineGranularity(particulars) {
  const p = String(particulars || '').toUpperCase();
  if (p.includes('NCHL') || p.includes('FONEPAY')) return 'CYCLE';
  if (p.includes('NT SIM') || p.includes('ADVANCE FROM')) return 'ONE_TO_ONE';
  if (p.includes('RBB PAYABLE') || p.includes('RASTRIYA BANIJYA')) return 'CYCLE';
  return 'ONE_TO_ONE';
}

function parseLedger(buffer) {
  const { schema, rows } = sniffFormat(buffer, 'ledger');
  
  let openingBalance = null;
  const transactions = [];
  const warnings = [];

  for (let i = schema.headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const miti = String(row[0] || '').trim();
    const dateVal = row[schema.date];
    const drcr = String(row[schema.drcr] || '').trim().toUpperCase();
    const particulars = String(row[schema.desc] || '').trim();
    
    // Parse numeric strings, remove commas
    const parseNum = (v) => v ? String(v).replace(/,/g, '') : 0;
    const debitCell = parseNum(row[schema.debit]);
    const creditCell = parseNum(row[schema.credit]);

    if (miti.toLowerCase() === 'total') continue;
    if (drcr.toLowerCase().includes('closing')) continue;

    if (particulars.toLowerCase().includes('opening')) {
      openingBalance = new Decimal(debitCell || creditCell || 0);
      continue;
    }

    if (!['DR', 'CR'].includes(drcr)) continue;

    const dateStr = extractDateString(dateVal);
    if (!dateStr) continue;

    try {
      const signedAmount = normaliseLedgerSign(drcr, debitCell, creditCell);
      transactions.push({
        dateStr,
        drcr,
        signedAmount,
        particulars,
        category: determineGranularity(particulars)
      });
    } catch (err) {
      warnings.push(`Row ${i}: ${err.message}`);
    }
  }

  return {
    openingBalance: openingBalance || new Decimal(0),
    transactions,
    warnings,
    rowCount: transactions.length
  };
}

module.exports = { parseLedger };