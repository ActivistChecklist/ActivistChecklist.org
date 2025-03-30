function generatePrivacyPreservingId(ipAddress, salt = '') {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(ipAddress + salt).digest('hex');
}

function getDayKey() {
  // Get current date in YYYY-MM-DD format to use as a daily key
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createGeoPreservingAnonymousIP(originalIP) {
  if (!originalIP) return null;

  // Keep the first two octets (which often correlate with geography)
  const ipParts = originalIP.split('.');
  if (ipParts.length !== 4) return originalIP; // Return original if not IPv4
  
  const [prefix1, prefix2] = ipParts;
  
  // Add the current day as salt to make the hash change daily
  // This ensures the same IP gets the same anonymized version within a 24-hour period
  const dailySalt = getDayKey();
  
  // Generate hash for the last two octets using IP + current day
  const userHash = generatePrivacyPreservingId(originalIP, dailySalt);
  const thirdOctet = parseInt(userHash.substring(0, 4), 16) % 256;
  const fourthOctet = parseInt(userHash.substring(4, 8), 16) % 256;
  
  // Combine the geographic network prefix with randomized host part
  return `${prefix1}.${prefix2}.${thirdOctet}.${fourthOctet}`;
}

module.exports = {
  createGeoPreservingAnonymousIP
};