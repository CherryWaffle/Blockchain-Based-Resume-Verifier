from fastapi import APIRouter

from ..blockchain import issue_credential, register_issuer, revoke_credential
from ..db import save_credential_record
from ..ipfs_upload import upload_credential_json
from ..models import IssueCredentialRequest, IssuerRegistrationRequest, RevokeCredentialRequest

router = APIRouter()


@router.post('/register-issuer')
def register_issuer_route(payload: IssuerRegistrationRequest):
    result = register_issuer(payload.issuer_address)
    return {'status': 'success', **result}


@router.post('/issue-credential')
def issue_credential_route(payload: IssueCredentialRequest):
    credential_payload = {
        'candidate_name': payload.candidate_name,
        'candidate_wallet': payload.candidate_wallet,
        'degree': payload.degree,
        'institution': payload.institution,
        'issue_date': payload.issue_date,
        'expiry_date': payload.expiry_date,
        'issuer_name': payload.issuer_name,
        'email': payload.email,
        'metadata': payload.metadata,
    }
    ipfs_cid = upload_credential_json(credential_payload)
    blockchain_result = issue_credential({**credential_payload, 'ipfs_cid': ipfs_cid})
    record = {
        'credential_id': blockchain_result['credential_id'],
        'candidate_wallet': payload.candidate_wallet,
        'candidate_name': payload.candidate_name,
        'degree': payload.degree,
        'institution': payload.institution,
        'issue_date': payload.issue_date,
        'expiry_date': payload.expiry_date,
        'ipfs_cid': ipfs_cid,
        'transaction_hash': blockchain_result['transaction_hash'],
    }
    save_credential_record(record)
    return {'status': 'success', **record}


@router.post('/revoke-credential')
def revoke_credential_route(payload: RevokeCredentialRequest):
    result = revoke_credential(payload.credential_id)
    return {'status': 'success', **result}
