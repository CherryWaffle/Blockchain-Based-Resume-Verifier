from fastapi import APIRouter

from ..blockchain import get_wallet_credential_ids
from ..models import WalletCredentialsResponse
from .verify import build_full_credential_response

router = APIRouter()


@router.get('/wallet/{wallet_address}/credentials', response_model=WalletCredentialsResponse)
def get_candidate_credentials(wallet_address: str):
    credential_ids = get_wallet_credential_ids(wallet_address)
    credentials = [build_full_credential_response(credential_id) for credential_id in credential_ids]
    return {'wallet_address': wallet_address, 'credentials': credentials}
