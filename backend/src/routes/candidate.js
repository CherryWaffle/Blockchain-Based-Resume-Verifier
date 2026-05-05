const express = require('express');
const router = express.Router();
const { mongoose } = require('../db');
const { CredentialSchema } = require('../models');

const Credential = mongoose.model('Credential', CredentialSchema);

router.get('/by-owner/:owner', async (req, res) => {
  try {
    const docs = await Credential.find({ owner: req.params.owner }).lean();
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
