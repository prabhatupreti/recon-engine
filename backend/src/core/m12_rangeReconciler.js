const Decimal = require('decimal.js');
const { addDays } = require('./m0_formatSniffer');

function reconcileRanges(ledgerTxns, bankTxns, cycles) {
  const results = [];
  let previousCycleEnd = null;

  const allDates = [
    ...ledgerTxns.map(t => t.dateStr),
    ...bankTxns.map(t => t.dateStr)
  ].filter(Boolean).sort();
  
  const absoluteStartDate = allDates.length > 0 ? allDates[0] : '1970-01-01';

  for (const cycleEnd of cycles) {
    let cycleStart = absoluteStartDate;
    if (previousCycleEnd) {
      cycleStart = addDays(previousCycleEnd, 1);
    }

    const ledgerInCycle = ledgerTxns.filter(tx => {
      return tx.dateStr >= cycleStart && tx.dateStr <= cycleEnd;
    });
    const ledgerNet = ledgerInCycle.reduce((sum, tx) => sum.plus(tx.signedAmount), new Decimal(0));

    const bankInCycle = bankTxns.filter(tx => {
      return tx.dateStr >= cycleStart && tx.dateStr <= cycleEnd;
    });
    const bankNet = bankInCycle.reduce((sum, tx) => sum.plus(tx.signedAmount), new Decimal(0));

    const variance = bankNet.minus(ledgerNet);
    const isMatch = variance.abs().lessThan(0.05);

    results.push({
      cycleStart,
      cycleEnd,
      ledgerNet: ledgerNet.toNumber(),
      bankNet: bankNet.toNumber(),
      variance: variance.toNumber(),
      isMatch,
      ledgerCount: ledgerInCycle.length,
      bankCount: bankInCycle.length,
      transactions: {
        ledger: ledgerInCycle.map(t => ({
          date: t.dateStr,
          desc: t.particulars || 'Unknown',
          amount: t.signedAmount.toNumber()
        })),
        bank: bankInCycle.map(t => ({
          date: t.dateStr,
          desc: t.desc || 'Unknown',
          amount: t.signedAmount.toNumber(),
          category: t.category || 'UNKNOWN'
        }))
      }
    });

    previousCycleEnd = cycleEnd;
  }

  return results;
}

module.exports = { reconcileRanges };