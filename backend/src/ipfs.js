const axios = require('axios');
const { pinataApiKey, pinataApiSecret } = require('./config');

async function pinJSON(json) {
  if (!pinataApiKey || !pinataApiSecret) throw new Error('Pinata keys not configured');
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;
  const res = await axios.post(url, json, {
    headers: {
      pinata_api_key: pinataApiKey,
      pinata_secret_api_key: pinataApiSecret,
      'Content-Type': 'application/json'
    }
  });
  return res.data; // contains IpfsHash
}

module.exports = { pinJSON };
