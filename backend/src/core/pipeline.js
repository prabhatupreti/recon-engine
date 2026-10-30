const { parseLedger } = require('./m1_ledgerParser');
const { parseBankStatement } = require('./m2_bankParser');
const { rebuildBalance } = require('./m3_balanceRebuilder');
const { pairReversals } = require('./m8_reversalPairer');
const { detectCycles } = require('./m11_cycleDetector');
const { reconcileRanges } = require('./m12_rangeReconciler');

function runPipeline(ledgerBuffer, bankBuffer) {
  const ledger = parseLedger(ledgerBuffer);
  const bank = parseBankStatement(bankBuffer);
  
  // Pass ledger.openingBalance here
  const tieout = rebuildBalance(bank, ledger.transactions, ledger.openingBalance);

  const reversalPairs = pairReversals(bank.transactions);
  const detectedCycles = detectCycles(ledger.transactions, bank.dayCloses, tieout.openingBalance);

  const rangeResults = reconcileRanges(ledger.transactions, bank.transactions, detectedCycles);

  const openingMatch = ledger.openingBalance.equals(tieout.openingBalance);
  const allCyclesMatched = rangeResults.every(r => r.isMatch);
  const passed = openingMatch && tieout.passed && allCyclesMatched;

  return {
    passed,
    engineVersion: '3.5.0 (Balance View)',
    ledger: { rowCount: ledger.rowCount, openingBalance: ledger.openingBalance.toString(), warnings: ledger.warnings },
    bank: { rowCount: bank.rowCount, dayCloseCount: Object.keys(bank.dayCloses).length, metadataSkipped: bank.metadataSkipped },
    sprint2: { detectedCycles, reversalPairs },
    tieout: { openingBalance: tieout.openingBalance.toString(), passed: tieout.passed, failedDates: tieout.failedDates, days: tieout.days },
    rangeReconciliation: rangeResults
  };
}

module.exports = { runPipeline };