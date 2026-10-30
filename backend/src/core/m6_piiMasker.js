/**
 * Masks 10-digit Nepali mobile numbers (starting with 96, 97, 98).
 * e.g., "9742356125" -> "97********"
 */
function maskPII(text) {
  if (!text) return '';
  return text.replace(/\b(9[678]\d{8})\b/g, (match) => {
    return match.substring(0, 2) + '********';
  });
}

function extractTxnId(text) {
  if (!text) return '';
  // Look for 6+ digit numbers or 10+ alphanumeric strings
  const match = text.match(/\b(\d{6,}|[A-Z0-9]{10,})\b/);
  return match ? match[1] : '';
}

module.exports = { maskPII, extractTxnId };