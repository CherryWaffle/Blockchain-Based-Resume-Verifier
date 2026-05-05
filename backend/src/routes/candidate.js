const express = require('express');
const router = express.Router();
const axios = require('axios');
const { mongoose } = require('../db');
const { CredentialSchema } = require('../models');
const { getContract } = require('../blockchain');

const Credential = mongoose.model('Credential', CredentialSchema);

async function fetchIpfsPayload(cid) {
  if (!cid) return null;
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
  try {
    const res = await axios.get(url, { timeout: 15000 });
    return res.data;
  } catch {
    return null;
  }
}

router.get('/by-owner/:owner', async (req, res) => {
  try {
    const owner = req.params.owner;
    const contract = getContract();
    const ids = await contract.methods.getCredentialIdsByWallet(owner).call();
    const credentials = [];

    for (const id of ids) {
      const result = await contract.methods.verifyCredential(id).call();
      const credential = {
        credential_id: String(id),
        valid: result.valid,
        revoked: result.revoked,
        expired: result.expired,
        candidate_wallet: result.candidate,
        issuer_wallet: result.issuer,
        candidate_name: result.candidateName,
        degree: result.degree,
        institution: result.institution,
        issue_date: Number(result.issueDate),
        expiry_date: Number(result.expiryDate),
        ipfs_cid: result.ipfsCid
      };

      const saved = await Credential.findOne({ credentialId: String(id) }).lean();
      credential.ipfs_payload = saved?.ipfsPayload || (await fetchIpfsPayload(result.ipfsCid));
      credentials.push(credential);
    }

    res.json({ wallet_address: owner, credentials });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
