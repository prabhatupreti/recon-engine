function classifyBankRow(desc) {
  if (!desc) return 'UNKNOWN';
  const d = desc.toUpperCase();
  
  if (d.includes('DAY CLOSE')) return 'DAY_CLOSE';
  if (d.includes('ECCH CHARGE') || d.includes('CHARGE')) return 'FEE';
  if (d.match(/TRF FROM 1006 TO 60001/)) return 'INTER_ACCOUNT_OUT';
  if (d.match(/^: 1670100000005006|^: 1670100000009006/)) return 'NDPC_POOL';
  if (d.match(/^: 1670100000010006/)) return 'SANIMA_GENERAL';
  if (d.match(/^:NAMASTEPAY\//) || d.match(/^:NAMESTEPAY\//)) return 'NAMASTEPAY_SLASH';
  if (d.includes('NAMASTEPAY') && d.includes('REV')) return 'NAMASTEPAY_REV';
  if (d.includes('NAMASTEPAY')) return 'NAMASTEPAY';
  if (d.match(/^WB\d{6}\./)) return 'WALLET_TO_BANK';
  if (d.includes('NABIL') && d.includes('OUT CLG')) return 'CLEARING';
  if (d.includes('PESKI FOR NDPC')) return 'NT_SIM_COMMISSION';
  if (d.match(/^\d{12}[A-Z0-9]+\//)) return 'CIPS';
  if (d.match(/^:?\s*\d{10}\//)) return 'NAMASTEPAY_LEGACY';
  
  return 'UNKNOWN';
}

module.exports = { classifyBankRow };