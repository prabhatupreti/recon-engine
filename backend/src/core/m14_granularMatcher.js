const Decimal = require('decimal.js');

function matchGranularly(ledgerTxns, bankTxns, cycles) {
  const results = [];
  let previousCycleEnd = null;

  const getStrDate = (tx) => tx.dateStr || (tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : String(tx.date));

  for (const cycleEnd of cycles) {
    const cycleStart = previousCycleEnd 
      ? new Date(new Date(previousCycleEnd).getTime() + 86400000).toISOString().split('T')[0]
      : '1970-01-01';

    // Filter for this cycle
    const cLedger = ledgerTxns.filter(tx => getStrDate(tx) > (previousCycleEnd || '1970-01-01') && getStrDate(tx) <= cycleEnd).map(tx => ({ ...tx, matched: false }));
    const cBank = bankTxns.filter(tx => getStrDate(tx) > (previousCycleEnd || '1970-01-01') && getStrDate(tx) <= cycleEnd).map(tx => ({ ...tx, matched: false }));

    // Pass 1: 1:1 Exact Matches
    cLedger.forEach(l => {
      const match = cBank.find(b => 
        !b.matched && 
        b.signedAmount.equals(l.signedAmount) && 
        Math.abs(new Date(b.dateStr) - new Date(l.dateStr)) <= 86400000 * 2 // ±2 days tolerance
      );
      if (match) {
        l.matched = true;
        match.matched = true;
        l.matchType = '1:1 Exact';
      }
    });

    // Pass 2: 1:Many (Cumulative) Matches by Category
    // Group unmatched ledger by category
    const unmatchedLedger = cLedger.filter(l => !l.matched);
    const unmatchedBank = cBank.filter(b => !b.matched);

    const ledgerByCat = {};
    unmatchedLedger.forEach(l => {
      if (!ledgerByCat[l.category]) ledgerByCat[l.category] = [];
      ledgerByCat[l.category].push(l);
    });

    Object.keys(ledgerByCat).forEach(cat => {
      const lSum = ledgerByCat[cat].reduce((sum, l) => sum.plus(l.signedAmount), new Decimal(0));
      
      // Find bank items that match this category (loose match on channel name)
      const bankCatItems = unmatchedBank.filter(b => 
        !b.matched && 
        (b.category === cat || b.category.includes(cat) || cat.includes(b.category))
      );

      if (bankCatItems.length > 0) {
        const bSum = bankCatItems.reduce((sum, b) => sum.plus(b.signedAmount), new Decimal(0));
        if (bSum.equals(lSum)) {
          ledgerByCat[cat].forEach(l => { l.matched = true; l.matchType = '1:Many Cumulative'; });
          bankCatItems.forEach(b => { b.matched = true; });
        }
      }
    });

    // Build Bridge (Exceptions)
    const unmatchedL = cLedger.filter(l => !l.matched);
    const unmatchedB = cBank.filter(b => !b.matched);

    results.push({
      cycleStart,
      cycleEnd,
      ledgerMatchedCount: cLedger.filter(l => l.matched).length,
      bankMatchedCount: cBank.filter(b => b.matched).length,
      exceptions: {
        ledger: unmatchedL.map(l => ({ date: l.dateStr, desc: l.particulars, amount: l.signedAmount.toNumber() })),
        bank: unmatchedB.map(b => ({ date: b.dateStr, desc: b.desc, amount: b.signedAmount.toNumber(), category: b.category }))
      }
    });

    previousCycleEnd = cycleEnd;
  }

  return results;
}

module.exports = { matchGranularly };