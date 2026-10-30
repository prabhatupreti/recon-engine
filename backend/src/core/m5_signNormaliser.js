const Decimal = require('decimal.js');

/**
 * Ledger: CR = positive (money in), DR = negative (money out).
 * The amount can be in either column, we rely on the DrCr flag.
 */
function normaliseLedgerSign(drcr, debitCell, creditCell) {
  if (!['DR', 'CR'].includes(drcr)) {
    throw new Error(`Invalid DrCr flag: ${drcr}`);
  }
  
  const debit = debitCell ? new Decimal(debitCell) : new Decimal(0);
  const credit = creditCell ? new Decimal(creditCell) : new Decimal(0);
  
  const amount = debit.isZero() ? credit : debit;
  
  return drcr === 'CR' ? amount : amount.negated();
}

/**
 * Bank: Credit column = positive, Debit column = negative.
 */
function normaliseBankSign(debitCell, creditCell) {
  const debit = debitCell ? new Decimal(debitCell) : new Decimal(0);
  const credit = creditCell ? new Decimal(creditCell) : new Decimal(0);
  
  if (!debit.isZero() && !credit.isZero()) {
    throw new Error('Bank row cannot have both Debit and Credit amounts.');
  }
  
  return credit.minus(debit);
}

module.exports = { normaliseLedgerSign, normaliseBankSign };