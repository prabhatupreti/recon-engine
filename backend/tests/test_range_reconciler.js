const { reconcileRanges } = require('../src/core/m12_rangeReconciler');
const Decimal = require('decimal.js');

describe('Range Reconciler', () => {
  test('Identifies exact matches and variances across cycles', () => {
    const ledger = [
      { dateStr: '2026-07-20', signedAmount: new Decimal(100) },
      { dateStr: '2026-07-25', signedAmount: new Decimal(50) }
    ];
    
    const bank = [
      { dateStr: '2026-07-18', signedAmount: new Decimal(100) },
      { dateStr: '2026-07-26', signedAmount: new Decimal(40) } // 10 variance in cycle 2
    ];

    const cycles = ['2026-07-24', '2026-07-31'];
    const results = reconcileRanges(ledger, bank, cycles);

    // Cycle 1 (up to Jul 24)
    expect(results[0].isMatch).toBe(true);
    expect(results[0].ledgerNet).toBe(100);
    expect(results[0].bankNet).toBe(100);

    // Cycle 2 (Jul 24 to Jul 31)
    expect(results[1].isMatch).toBe(false);
    expect(results[1].variance).toBe(-10);
  });
});