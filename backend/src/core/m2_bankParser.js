const { sniffFormat, extractDateString } = require('./m0_formatSniffer');
const { normaliseBankSign } = require('./m5_signNormaliser');
const { maskPII, extractTxnId } = require('./m6_piiMasker');
const { classifyBankRow } = require('./m7_channelClassifier');
const Decimal = require('decimal.js');

function parseBankStatement(buffer) {
  const { schema, rows } = sniffFormat(buffer, 'bank');
  const transactions = [];
  const dayCloses = {};
  const warnings = [];
  let metadataSkipped = 0;

  for (let i = schema.headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    const dateCell = schema.date !== -1 ? row[schema.date] : row[0];
    const desc1 = schema.desc !== -1 ? String(row[schema.desc] || '').trim() : String(row[1] || '').trim();
    
    const parseNum = (v) => v ? String(v).replace(/,/g, '') : 0;
    const debitCell = parseNum(schema.debit !== -1 ? row[schema.debit] : row[4]);
    const creditCell = parseNum(schema.credit !== -1 ? row[schema.credit] : row[5]);
    const balanceCell = parseNum(schema.balance !== -1 ? row[schema.balance] : row[6]);

    if (!dateCell) {
      if (desc1.startsWith('MAINCODE') || desc1.startsWith('Name :-') || desc1.startsWith('Statement From')) {
        metadataSkipped++;
      }
      continue;
    }

    const dateStr = extractDateString(dateCell);
    if (!dateStr) continue;

    if (desc1.startsWith('~ DAY CLOSE') || desc1.toLowerCase().includes('day close')) {
      dayCloses[dateStr] = new Decimal(balanceCell || 0);
      continue;
    }

    if (!debitCell && !creditCell) continue;

    const signedAmount = normaliseBankSign(debitCell, creditCell);
    const rawDesc = [desc1, row[schema.desc + 1], row[schema.desc + 2]].filter(Boolean).join(' | ');
    
    const category = classifyBankRow(rawDesc);

    transactions.push({
      dateStr,
      signedAmount,
      desc: maskPII(rawDesc),
      txnId: extractTxnId(desc1),
      direction: signedAmount.isNegative() ? 'DR' : 'CR',
      category
    });
  }

  return {
    transactions,
    dayCloses,
    metadataSkipped,
    warnings,
    rowCount: transactions.length
  };
}

module.exports = { parseBankStatement };