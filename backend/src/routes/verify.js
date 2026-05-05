const express = require('express');
const router = express.Router();
const { getContract } = require('../blockchain');

router.get('/onchain/:credentialId', async (req, res) => {
  try {
    const contract = getContract();
    const status = await contract.methods.verifyCredential(req.params.credentialId).call();
    res.json({ credentialId: req.params.credentialId, verified: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
