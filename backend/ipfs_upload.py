from typing import Any, Dict

import requests
from fastapi import HTTPException

from .config import settings

PINATA_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS'


def upload_credential_json(payload: Dict[str, Any]) -> str:
    if not settings.pinata_api_key or not settings.pinata_secret_key:
        raise HTTPException(status_code=500, detail='Pinata credentials are not configured')

    headers = {
        'pinata_api_key': settings.pinata_api_key,
        'pinata_secret_api_key': settings.pinata_secret_key,
        'Content-Type': 'application/json',
    }
    body = {
        'pinataContent': payload,
        'pinataMetadata': {
            'name': f"resume-credential-{payload.get('candidate_name', 'candidate')}",
        },
    }
    response = requests.post(PINATA_URL, json=body, headers=headers, timeout=60)
    if response.status_code >= 400:
        raise HTTPException(status_code=response.status_code, detail=response.text)

    data = response.json()
    cid = data.get('IpfsHash')
    if not cid:
        raise HTTPException(status_code=502, detail='Pinata did not return an IPFS hash')
    return cid
