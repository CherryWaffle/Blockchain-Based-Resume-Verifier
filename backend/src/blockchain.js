const Web3 = require('web3');
const fs = require('fs');
const { alchemyUrl, privateKey, contractAddress, contractAbiPath } = require('./config');

const web3 = new Web3(alchemyUrl || 'http://127.0.0.1:8545');

function loadAbi() {
  if (!fs.existsSync(contractAbiPath)) throw new Error(`ABI not found: ${contractAbiPath}`);
  const raw = fs.readFileSync(contractAbiPath, 'utf8');
  return JSON.parse(raw).abi || JSON.parse(raw);
}

function getContract() {
  const abi = loadAbi();
  if (!contractAddress) throw new Error('CONTRACT_ADDRESS not configured');
  return new web3.eth.Contract(abi, contractAddress);
}

async function sendTx(txObject) {
  if (!privateKey) throw new Error('PRIVATE_KEY not set');
  const account = web3.eth.accounts.privateKeyToAccount(privateKey);
  const from = account.address;
  const chainId = await web3.eth.getChainId();
  const nonce = await web3.eth.getTransactionCount(from, 'pending');
  const gasPrice = await web3.eth.getGasPrice();
  const gas = txObject.gas || (await web3.eth.estimateGas({ from, to: txObject.to, data: txObject.data }));
  const tx = { ...txObject, from, gas, gasPrice, nonce, chainId };
  const signed = await account.signTransaction(tx);
  return web3.eth.sendSignedTransaction(signed.rawTransaction);
}

module.exports = { web3, getContract, sendTx };
