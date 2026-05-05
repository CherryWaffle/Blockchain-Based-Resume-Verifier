const path = require('path');
const dotenv = require('dotenv');

const backendEnv = path.resolve(process.cwd(), '.env');
const rootEnv = path.resolve(process.cwd(), '..', '.env');

// Load backend .env first, fall back to repo root .env
if (require('fs').existsSync(backendEnv)) {
  dotenv.config({ path: backendEnv });
} else if (require('fs').existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
}

const rawAbiPath = process.env.CONTRACT_ABI_PATH || 'backend/abi/ResumeVerifier.json';
const resolvedAbiPath = path.isAbsolute(rawAbiPath)
  ? rawAbiPath
  : path.resolve(process.cwd(), '..', rawAbiPath);

module.exports = {
  port: process.env.PORT || 8000,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/resume_verifier',
  pinataApiKey: process.env.PINATA_API_KEY,
  pinataApiSecret: process.env.PINATA_API_SECRET,
  alchemyUrl: process.env.ALCHEMY_AMOY_URL,
  privateKey: process.env.PRIVATE_KEY,
  contractAddress: process.env.CONTRACT_ADDRESS,
  contractAbiPath: resolvedAbiPath
};
