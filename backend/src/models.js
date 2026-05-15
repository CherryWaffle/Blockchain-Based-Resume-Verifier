const { Schema } = require('mongoose');

const CredentialSchema = new Schema({
  credentialId: String,
  candidateWallet: String,
  issuerWallet: String,
  candidateName: String,
  degree: String,
  institution: String,
  issueDate: Number,
  expiryDate: Number,
  ipfsCid: String,
  ipfsPayload: Schema.Types.Mixed,
  revoked: { type: Boolean, default: false }
});

const VerificationSchema = new Schema({
  credentialId: String,
  verifier: String,
  result: Boolean,
  checkedAt: { type: Date, default: Date.now }
});

const SignedRequestSchema = new Schema({
  issuer: String,
  nonce: String,
  usedAt: { type: Date, default: Date.now }
});

SignedRequestSchema.index({ issuer: 1, nonce: 1 }, { unique: true });

module.exports = { CredentialSchema, VerificationSchema, SignedRequestSchema };
