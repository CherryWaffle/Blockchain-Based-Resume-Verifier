const express = require('express');
const router = express.Router();
const { verifyTypedData } = require('ethers');
const { pinJSON } = require('../ipfs');
const { getContract, sendTx, web3 } = require('../blockchain');
const { contractAddress } = require('../config');
const { mongoose } = require('../db');
const { CredentialSchema, SignedRequestSchema } = require('../models');

const Credential = mongoose.model('Credential', CredentialSchema);
const SignedRequest = mongoose.model('SignedRequest', SignedRequestSchema);

function normalizeAddress(value) {
  return (value || '').toLowerCase();
}

function buildIssueTypedData({ chainId, issuer, candidateWallet, candidateName, degree, institution, issueDate, expiryDate, nonce, deadline }) {
  return {
    domain: {
      name: 'ResumeVerifier',
      version: '1',
      chainId,
      verifyingContract: contractAddress
    },
    types: {
      IssueCredential: [
        { name: 'issuer', type: 'address' },
        { name: 'candidateWallet', type: 'address' },
        { name: 'candidateName', type: 'string' },
        { name: 'degree', type: 'string' },
        { name: 'institution', type: 'string' },
        { name: 'issueDate', type: 'uint256' },
        { name: 'expiryDate', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' }
      ]
    },
    message: {
      issuer,
      candidateWallet,
      candidateName,
      degree,
      institution,
      issueDate,
      expiryDate,
      nonce,
      deadline
    }
  };
}

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
      issuer,
      signature,
      nonce,
      deadline,
      candidateWallet,
      candidateName,
      degree,
      institution,
      issueDate,
      expiryDate,
      metadata
    } = req.body;

    if (!issuer || !signature || !nonce || !deadline) {
      return res.status(400).json({ error: 'issuer, signature, nonce, deadline are required' });
    }

    if (!candidateWallet || !candidateName || !degree || !institution || !issueDate || !expiryDate) {
      return res.status(400).json({ error: 'candidateWallet, candidateName, degree, institution, issueDate, expiryDate are required' });
    }

    if (!contractAddress) {
      return res.status(500).json({ error: 'CONTRACT_ADDRESS not configured' });
    }

    const now = Math.floor(Date.now() / 1000);
    if (Number(deadline) < now) {
      return res.status(400).json({ error: 'signature expired' });
    }

    const chainId = await web3.eth.getChainId();
    const typedData = buildIssueTypedData({
      chainId,
      issuer,
      candidateWallet,
      candidateName,
      degree,
      institution,
      issueDate: Number(issueDate),
      expiryDate: Number(expiryDate),
      nonce: String(nonce),
      deadline: Number(deadline)
    });

    const recovered = verifyTypedData(typedData.domain, typedData.types, typedData.message, signature);
    if (normalizeAddress(recovered) !== normalizeAddress(issuer)) {
      return res.status(401).json({ error: 'invalid issuer signature' });
    }

    const nonceKey = String(nonce);
    const issuerKey = normalizeAddress(issuer);
    const existing = await SignedRequest.findOne({ issuer: issuerKey, nonce: nonceKey }).lean();
    if (existing) {
      return res.status(409).json({ error: 'nonce already used' });
    }

    await SignedRequest.create({ issuer: issuerKey, nonce: nonceKey });

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
      issuerWallet: issuer,
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
