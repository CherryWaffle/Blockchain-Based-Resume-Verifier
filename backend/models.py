from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class IssuerRegistrationRequest(BaseModel):
    issuer_address: str = Field(..., description='Wallet address that will receive the ISSUER role')


class IssueCredentialRequest(BaseModel):
    candidate_name: str
    candidate_wallet: str
    degree: str
    institution: str
    issue_date: int
    expiry_date: int
    issuer_name: Optional[str] = None
    email: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class RevokeCredentialRequest(BaseModel):
    credential_id: int


class CredentialResponse(BaseModel):
    credential_id: int
    candidate_wallet: str
    candidate_name: str
    degree: str
    institution: str
    issue_date: int
    expiry_date: int
    ipfs_cid: str
    issuer: str
    revoked: bool
    expired: bool
    valid: bool
    ipfs_payload: Dict[str, Any] = Field(default_factory=dict)


class WalletCredentialsResponse(BaseModel):
    wallet_address: str
    credentials: List[CredentialResponse]


class VerifyCredentialResponse(BaseModel):
    credential: CredentialResponse
    transaction_hash: Optional[str] = None
