function generatePrivacyPreservingId(ipAddress, salt = '') {
  const crypto = require('crypto');
  // Add the server-side secret key to the hash
  const ipHashSalt = process.env.IP_HASH_SALT;
  return crypto.createHash('sha256').update(ipAddress + salt + ipHashSalt).digest('hex');
}

function getDayKey() {
  // Get current date in YYYY-MM-DD format to use as a daily key
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function createGeoPreservingAnonymousIP(originalIP) {
  if (!originalIP) return null;

  // Parse IP address
  const ipParts = originalIP.split('.');
  if (ipParts.length !== 4) return originalIP; // Return original if not IPv4
  
  const [prefix1, prefix2, thirdOctet, fourthOctet] = ipParts;
  
  // Add the current day as salt to make the hash change daily
  const dailySalt = getDayKey();
  
  // Generate hash for the user
  const userHash = generatePrivacyPreservingId(originalIP, dailySalt);
  
  // Keep first two octets intact for broad geo accuracy
  // For the third octet, preserve some patterns by keeping the high-order bits
  // but randomize the rest (preserves subnet groups while adding anonymity)
  const thirdOctetInt = parseInt(thirdOctet);
  const thirdOctetHigh = thirdOctetInt & 0xE0; // Keep top 3 bits (224 mask)
  const thirdOctetRandom = parseInt(userHash.substring(0, 2), 16) & 0x1F; // Random 5 bits
  const anonymizedThird = thirdOctetHigh | thirdOctetRandom;
  
  // Completely randomize the fourth octet
  const anonymizedFourth = parseInt(userHash.substring(2, 6), 16) % 256;
  
  // Combine preserved and randomized parts
  return `${prefix1}.${prefix2}.${anonymizedThird}.${anonymizedFourth}`;
}

module.exports = {
  createGeoPreservingAnonymousIP
};