const express = require('express');
const router = express.Router();
const { pinJSON } = require('../ipfs');
const { getContract, sendTx } = require('../blockchain');
const { mongoose } = require('../db');
const { CredentialSchema } = require('../models');

const Credential = mongoose.model('Credential', CredentialSchema);

router.post('/register', async (req, res) => {
  try {
    const contract = getContract();
    const issuer = req.body.issuer;
    if (!issuer) return res.status(400).json({ error: 'issuer is required' });
    const data = contract.methods.registerIssuer(issuer).encodeABI();
    const tx = { to: contract.options.address, data, gas: 500000 };
    const receipt = await sendTx(tx);
    res.json({ success: true, receipt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/issue', async (req, res) => {
  try {
    const {
      candidateWallet,
      candidateName,
      degree,
      institution,
      issueDate,
      expiryDate,
      metadata
    } = req.body;

    if (!candidateWallet || !candidateName || !degree || !institution || !issueDate || !expiryDate) {
      return res.status(400).json({ error: 'candidateWallet, candidateName, degree, institution, issueDate, expiryDate are required' });
    }

    const pin = await pinJSON(metadata || {});
    const ipfsCid = pin.IpfsHash;
    const contract = getContract();
    const data = contract.methods
      .issueCredential(candidateWallet, candidateName, degree, institution, Number(issueDate), Number(expiryDate), ipfsCid)
      .encodeABI();
    const tx = { to: contract.options.address, data, gas: 900000 };
    const receipt = await sendTx(tx);

    // Get the latest credential id for the candidate
    const ids = await contract.methods.getCredentialIdsByWallet(candidateWallet).call();
    const credentialId = ids && ids.length ? String(ids[ids.length - 1]) : undefined;

    const cred = new Credential({
      credentialId,
      candidateWallet,
      issuerWallet: receipt.from || 'on-chain',
      candidateName,
      degree,
      institution,
      issueDate: Number(issueDate),
      expiryDate: Number(expiryDate),
      ipfsCid,
      ipfsPayload: metadata || {}
    });
    await cred.save();

    res.json({ success: true, receipt, credentialId, ipfsCid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
