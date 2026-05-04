from typing import Any, Dict

import requests
from fastapi import APIRouter, HTTPException

from ..blockchain import fetch_credential, get_wallet_credential_ids
from ..db import save_verification_record
from ..models import CredentialResponse, VerifyCredentialResponse, WalletCredentialsResponse

router = APIRouter()
IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs/'


def _fetch_ipfs_payload(cid: str) -> Dict[str, Any]:
    response = requests.get(f'{IPFS_GATEWAY}{cid}', timeout=60)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail='Unable to fetch credential data from IPFS')
    return response.json()


def build_full_credential_response(credential_id: int) -> CredentialResponse:
    chain_data = fetch_credential(credential_id)
    ipfs_payload = _fetch_ipfs_payload(chain_data['ipfs_cid'])
    credential = CredentialResponse(
        credential_id=credential_id,
        candidate_wallet=chain_data['candidate_wallet'],
        candidate_name=chain_data['candidate_name'],
        degree=chain_data['degree'],
        institution=chain_data['institution'],
        issue_date=chain_data['issue_date'],
        expiry_date=chain_data['expiry_date'],
        ipfs_cid=chain_data['ipfs_cid'],
        issuer=chain_data['issuer'],
        revoked=chain_data['revoked'],
        expired=chain_data['expired'],
        valid=chain_data['valid'],
        ipfs_payload=ipfs_payload,
    )
    save_verification_record({'credential_id': credential_id, 'status': credential.valid, 'ipfs_cid': credential.ipfs_cid})
    return credential


@router.get('/credential/{credential_id}', response_model=VerifyCredentialResponse)
def verify_credential_route(credential_id: int):
    credential = build_full_credential_response(credential_id)
    return {'credential': credential}


@router.get('/wallet/{wallet_address}', response_model=WalletCredentialsResponse)
def verify_wallet_route(wallet_address: str):
    credential_ids = get_wallet_credential_ids(wallet_address)
    credentials = [build_full_credential_response(credential_id) for credential_id in credential_ids]
    return {'wallet_address': wallet_address, 'credentials': credentials}
