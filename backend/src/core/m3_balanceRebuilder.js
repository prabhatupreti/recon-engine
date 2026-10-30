const Decimal = require('decimal.js');

// Changed signature to accept ledgerOpeningBalance
function rebuildBalance(bankResult, ledgerTransactions, ledgerOpeningBalance) {
  const { transactions: bankTxns, dayCloses } = bankResult;
  
  if (!dayCloses || Object.keys(dayCloses).length === 0) {
    throw new Error('No day-close rows found in the bank statement.');
  }

  const bankNetByDate = {};
  bankTxns.forEach(tx => {
    if (!bankNetByDate[tx.dateStr]) bankNetByDate[tx.dateStr] = new Decimal(0);
    bankNetByDate[tx.dateStr] = bankNetByDate[tx.dateStr].plus(tx.signedAmount);
  });

  const ledgerNetByDate = {};
  ledgerTransactions.forEach(tx => {
    if (!ledgerNetByDate[tx.dateStr]) ledgerNetByDate[tx.dateStr] = new Decimal(0);
    ledgerNetByDate[tx.dateStr] = ledgerNetByDate[tx.dateStr].plus(tx.signedAmount);
  });

  const allDates = Array.from(new Set([
    ...Object.keys(bankNetByDate),
    ...Object.keys(dayCloses)
  ])).sort();

  if (allDates.length === 0) throw new Error('No transactions or day-closes found.');

  const firstCloseDate = Object.keys(dayCloses).sort()[0];
  const firstCloseValue = dayCloses[firstCloseDate];
  
  let netUpToFirst = new Decimal(0);
  allDates.forEach(d => {
    if (d <= firstCloseDate && bankNetByDate[d]) {
      netUpToFirst = netUpToFirst.plus(bankNetByDate[d]);
    }
  });

  const bankOpeningBalance = firstCloseValue.minus(netUpToFirst);
  
  let runningLedger = new Decimal(ledgerOpeningBalance);
  const days = [];
  const failedDates = [];

  allDates.forEach(d => {
    const bankNet = bankNetByDate[d] || new Decimal(0);
    const ledgerNet = ledgerNetByDate[d] || new Decimal(0);
    
    runningLedger = runningLedger.plus(ledgerNet);
    
    if (dayCloses[d]) {
      const statedBank = dayCloses[d];
      
      // Now we compare the actual balances, not just the daily movement
      const dailyVariance = statedBank.minus(runningLedger);
      const passed = dailyVariance.abs().lessThan(0.05);
      
      if (!passed) failedDates.push(d);
      
      days.push({
        date: d,
        ledgerBalance: runningLedger.toNumber(),
        bankBalance: statedBank.toNumber(),
        ledgerMovement: ledgerNet.toNumber(),
        bankMovement: bankNet.toNumber(),
        delta: dailyVariance.toNumber(),
        passed
      });
    }
  });

  return {
    openingBalance: bankOpeningBalance,
    days,
    failedDates,
    passed: failedDates.length === 0
  };
}

module.exports = { rebuildBalance };