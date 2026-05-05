const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

module.exports = {
  port: process.env.PORT || 8000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/resume_verifier',
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataApiSecret: process.env.PINATA_API_SECRET,
  alchemyUrl: process.env.ALCHEMY_AMOY_URL,
  privateKey: process.env.PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS,
  contractAbiPath: process.env.CONTRACT_ABI_PATH || path.resolve(__dirname, '../abi/ResumeVerifier.json')
};
