function pairReversals(transactions) {
  const pairs = [];
  const revisions = transactions.filter(t => t.category === 'NAMASTEPAY_REV');
  
  revisions.forEach(rev => {
    const original = transactions.find(t => 
      t.txnId === rev.txnId && 
      t.direction === 'CR' && 
      t.date <= rev.date &&
      !t.isReversed
    );

    if (original) {
      original.isReversed = true;
      rev.isReversal = true;
      rev.reversalOf = original.txnId;
      
      pairs.push({
        txnId: rev.txnId,
        originalDate: original.dateStr,
        originalAmount: original.signedAmount.toString(),
        reversalDate: rev.dateStr,
        reversalAmount: rev.signedAmount.toString()
      });
    }
  });

  return pairs;
}

module.exports = { pairReversals };