# Blockchain-Based-Resume-Verifier

Blockchain-based resume credential verifier for Polygon PoS.

## Stack

- Smart contract: Solidity + OpenZeppelin AccessControl
- Testing: Brownie + pytest
- Backend: Node.js, Express, web3.js, mongoose, dotenv, axios
- File storage: IPFS via Pinata
- Frontend: React.js, Tailwind CSS, ethers.js, MetaMask
- Database: MongoDB Atlas

## Project Structure

- `contracts/ResumeVerifier.sol` - on-chain credential registry
- `tests/test_resume_verifier.py` - Brownie + pytest coverage
- `scripts/deploy.py` - Brownie deploy script
- `backend/` - Node/Express API, Pinata upload helper, web3.js contract access, MongoDB persistence
- `frontend/` - React dashboard for issuers, candidates, and verifiers

## Environment

Copy `.env.example` to `.env` and fill in your local secrets. This repository is intended for public source control, so `.env` and frontend env files are ignored by default.

Required variables:

- `PRIVATE_KEY`
- `ALCHEMY_AMOY_URL`
- `CONTRACT_ADDRESS`
- `CONTRACT_ABI_PATH`
- `PINATA_API_KEY`
- `PINATA_API_SECRET`
- `MONGODB_URI`

## Local Run

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Brownie tests:

```bash
brownie test
```
