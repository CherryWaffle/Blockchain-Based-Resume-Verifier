const express = require('express');
const router = express.Router();
const { pinJSON } = require('../ipfs');
const { getContract, web3, sendTx } = require('../blockchain');
const { mongoose } = require('../db');
const { CredentialSchema } = require('../models');

const Credential = mongoose.model('Credential', CredentialSchema);

router.post('/register', async (req, res) => {
  try {
    const contract = getContract();
    const data = contract.methods.registerIssuer(req.body.issuer).encodeABI();
    const tx = { to: contract.options.address, data, gas: 500000 };
    const receipt = await sendTx(tx);
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issue', async (req, res) => {
  try {
    const { metadata, owner, credentialId } = req.body;
    const pin = await pinJSON(metadata);
    const ipfsHash = pin.IpfsHash;
    const contract = getContract();
    const data = contract.methods.issueCredential(owner, credentialId, ipfsHash).encodeABI();
    const tx = { to: contract.options.address, data, gas: 700000 };
    const receipt = await sendTx(tx);
    const cred = new (mongoose.model('Credential'))({ credentialId, owner, issuer: 'on-chain', ipfsHash, metadata });
    await cred.save();
    res.json({ success: true, receipt, ipfsHash });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
