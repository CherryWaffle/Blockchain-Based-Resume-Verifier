const express = require('express');
const router = express.Router();
const axios = require('axios');
const { getContract } = require('../blockchain');

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

router.get('/onchain/:credentialId', async (req, res) => {
  try {
    const contract = getContract();
    const result = await contract.methods.verifyCredential(req.params.credentialId).call();
    const credential = {
      credential_id: String(req.params.credentialId),
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
      ipfs_cid: result.ipfsCid,
      ipfs_payload: await fetchIpfsPayload(result.ipfsCid)
    };
    res.json({ credential });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
