# Blockchain-Based Resume Verifier 🔗

Credential verification for resumes on Ganache or Polygon Amoy. Issuers publish structured credentials to IPFS, the backend writes the CID on-chain, and verifiers can check authenticity and status in real time. 🧾

## Highlights

- Role-based issuance and revocation using OpenZeppelin `AccessControl`
- IPFS storage via Pinata for full credential payloads
- Ganache local chain or Polygon Amoy deployment with a thin Node/Express API
- React dashboard for issuer, candidate, and verifier workflows

## Tech Stack

- Smart contract: Solidity 0.8.20 + OpenZeppelin `AccessControl`
- Backend: Node.js, Express, web3.js, mongoose, dotenv, axios
- Frontend: React, Vite, Tailwind CSS, ethers, MetaMask
- Storage: IPFS via Pinata
- Database: MongoDB Atlas

## Architecture

1. Issuer submits credential data.
2. Backend pins JSON to IPFS and receives a CID.
3. Contract stores CID and metadata on-chain.
4. Candidates and verifiers read on-chain state and IPFS payloads.

## Repository Layout

- `contracts/` — Solidity contracts (`ResumeVerifier.sol`)
- `tools/` — build scripts (Solidity compile)
- `scripts/` — Brownie deploy (optional)
- `backend/` — Express API, web3 integration, Mongo persistence
- `frontend/` — React UI
- `tests/` — Brownie tests

## Environment Setup ✅

Create a root `.env` (copy from `.env.example`). These values are required:

| Key | Description |
| --- | --- |
| `RPC_URL` | RPC URL (Ganache: `http://127.0.0.1:8545`) |
| `PRIVATE_KEY` | Issuer/admin wallet private key (never commit) |
| `ALCHEMY_AMOY_URL` | Optional Polygon Amoy RPC URL |
| `CONTRACT_ADDRESS` | Deployed contract address |
| `CONTRACT_ABI_PATH` | ABI path (use `backend/abi/ResumeVerifier.json`) |
| `PINATA_API_KEY` | Pinata API key |
| `PINATA_API_SECRET` | Pinata API secret |
| `MONGODB_URI` | MongoDB Atlas connection string |

Optional frontend env:

- `VITE_BACKEND_URL` (defaults to `http://localhost:8000`)
- `VITE_CONTRACT_ADDRESS` (required for secure issuance signing)

## Build & Run 🚀

### 1) Install root tooling

This installs `solc`, `web3`, and OpenZeppelin for the local compiler script.

```bash
npm install
```

### 2) Compile the contract

```bash
node tools/compile_with_solcjs.js
```

Outputs:

- `build/contracts/ResumeVerifier.json`
- `backend/abi/ResumeVerifier.json`

### 3) Start Ganache (local chain)

Install Ganache if needed:

```bash
npm install -g ganache
```

Start the local chain:

```bash
ganache -p 8545
```

Copy one of the private keys from Ganache into your `.env` as `PRIVATE_KEY` and set `RPC_URL=http://127.0.0.1:8545`. If you use MetaMask, add a custom network with the Ganache RPC URL and chain ID shown in the Ganache output.

### 4) Deploy to Ganache (local)

```bash
node -e "const fs=require('fs');const Web3Pkg=require('web3');const Web3=Web3Pkg.Web3||Web3Pkg;require('dotenv').config();const rpc=process.env.RPC_URL||'http://127.0.0.1:8545';const w=new Web3(rpc);const pk=(process.env.PRIVATE_KEY||'').trim();const pkFixed=pk.startsWith('0x')?pk:'0x'+pk;const acct=w.eth.accounts.privateKeyToAccount(pkFixed);w.eth.accounts.wallet.add(acct);(async()=>{const art=JSON.parse(fs.readFileSync('build/contracts/ResumeVerifier.json','utf8'));const c=new w.eth.Contract(art.abi);const tx=c.deploy({data:'0x'+art.bytecode});const gas=await tx.estimateGas();const gasPrice=await w.eth.getGasPrice();const inst=await tx.send({from:acct.address,gas,gasPrice});console.log('DEPLOYED',inst.options.address);})().catch(e=>{console.error(e);process.exit(1)});"
```

Update `.env` with the deployed address:

```bash
CONTRACT_ADDRESS=0xYourDeployedAddress
```

### 5) Start backend

```bash
cd backend
npm install
npm run dev
```

If you use MongoDB Atlas, whitelist your current IP (or temporarily `0.0.0.0/0`). ⚠️

### Secure issuance flow 🔐

The backend now requires an EIP-712 signature for `/issuer/issue`. The frontend signs the issuance payload with MetaMask and sends `issuer`, `nonce`, `deadline`, and `signature` alongside the credential fields.

### 6) Start frontend

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL printed in the terminal.

### Deploy to Polygon Amoy (optional)

Ensure your `.env` has `PRIVATE_KEY` and `ALCHEMY_AMOY_URL`, then deploy:

```bash
node -e "const fs=require('fs');const Web3Pkg=require('web3');const Web3=Web3Pkg.Web3||Web3Pkg;require('dotenv').config();const w=new Web3(process.env.ALCHEMY_AMOY_URL);const pk=(process.env.PRIVATE_KEY||'').trim();const pkFixed=pk.startsWith('0x')?pk:'0x'+pk;const acct=w.eth.accounts.privateKeyToAccount(pkFixed);w.eth.accounts.wallet.add(acct);(async()=>{const art=JSON.parse(fs.readFileSync('build/contracts/ResumeVerifier.json','utf8'));const c=new w.eth.Contract(art.abi);const tx=c.deploy({data:'0x'+art.bytecode});const gas=await tx.estimateGas();const maxPriorityFeePerGas=w.utils.toWei('30','gwei');const maxFeePerGas=w.utils.toWei('60','gwei');const inst=await tx.send({from:acct.address,gas,maxPriorityFeePerGas,maxFeePerGas});console.log('DEPLOYED',inst.options.address);})().catch(e=>{console.error(e);process.exit(1)});"
```

## API Endpoints

- `GET /health`
- `POST /issuer/register`
	- body: `{ "issuer": "0x..." }`
- `POST /issuer/issue`
	- body: `{ "issuer", "signature", "nonce", "deadline", "candidateWallet", "candidateName", "degree", "institution", "issueDate", "expiryDate", "metadata" }`
- `GET /candidate/by-owner/:owner`
- `GET /verify/onchain/:credentialId`

## Contract Roles

- `DEFAULT_ADMIN_ROLE`: can register issuers
- `ISSUER_ROLE`: can issue and revoke credentials
- `VERIFIER_ROLE`: read-only verification access

## Public Repo Safety ✅

Do not commit secrets. The `.gitignore` already excludes:

- `.env` and frontend env files
- `node_modules/`
- `build/` artifacts
- extra ABI files (only `backend/abi/ResumeVerifier.json` is kept)

## Troubleshooting

- **MongoDB Atlas connect error**: add your IP to Atlas Network Access.
- **Low gas tip error**: increase `maxPriorityFeePerGas` / `maxFeePerGas` in deploy command.
- **Frontend styles broken**: reinstall frontend deps (`npm install`).

## License

See `LICENSE`.
