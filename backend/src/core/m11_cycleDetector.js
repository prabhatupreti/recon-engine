const Decimal = require('decimal.js');
const { addDays } = require('./m0_formatSniffer');

function detectCycles(ledgerTransactions, bankDayCloses, bankOpeningBalance) {
  const cycles = [];
  
  const ledgerByDate = {};
  ledgerTransactions.forEach(t => {
    if (!ledgerByDate[t.dateStr]) ledgerByDate[t.dateStr] = new Decimal(0);
    ledgerByDate[t.dateStr] = ledgerByDate[t.dateStr].plus(t.signedAmount);
  });

  const bankDates = Object.keys(bankDayCloses).sort();
  let runningLedger = new Decimal(bankOpeningBalance);

  // Pass 1: Exact Balance Matching
  bankDates.forEach(date => {
    if (ledgerByDate[date]) {
      runningLedger = runningLedger.plus(ledgerByDate[date]);
    }
    
    const bankClose = bankDayCloses[date];
    const delta = bankClose.minus(runningLedger).abs();

    if (delta.lessThan(0.05)) {
      cycles.push(date);
    }
  });

  // Pass 2: Fallback to Weekly Cycles
  if (cycles.length === 0 && bankDates.length > 0) {
    let currentDate = bankDates[0];
    const endDate = bankDates[bankDates.length - 1];
    
    while (currentDate <= endDate) {
      const nextWeek = addDays(currentDate, 6);
      
      if (nextWeek <= endDate) {
        cycles.push(nextWeek);
      } else {
        cycles.push(endDate);
        break;
      }
      
      // FIXED TYPO HERE
      currentDate = addDays(currentDate, 7); 
    }
  }

  return cycles;
}

module.exports = { detectCycles };