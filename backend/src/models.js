const { Schema } = require('mongoose');

const CredentialSchema = new Schema({
  credentialId: String,
  owner: String,
  issuer: String,
  ipfsHash: String,
  metadata: Schema.Types.Mixed,
  issuedAt: { type: Date, default: Date.now },
  revoked: { type: Boolean, default: false }
});

const VerificationSchema = new Schema({
  credentialId: String,
  verifier: String,
  result: Boolean,
  checkedAt: { type: Date, default: Date.now }
});

module.exports = { CredentialSchema, VerificationSchema };
