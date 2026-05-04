from typing import Any, Dict, List

from fastapi import HTTPException
from web3 import Web3

try:
    from web3.middleware import ExtraDataToPOAMiddleware
except ImportError:  # pragma: no cover - web3 middleware paths vary by version
    ExtraDataToPOAMiddleware = None

from .config import settings

CONTRACT_ABI = [
    {
        'inputs': [{'internalType': 'address', 'name': 'issuer', 'type': 'address'}],
        'name': 'registerIssuer',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function',
    },
    {
        'inputs': [
            {'internalType': 'address', 'name': 'candidate', 'type': 'address'},
            {'internalType': 'string', 'name': 'candidateName', 'type': 'string'},
            {'internalType': 'string', 'name': 'degree', 'type': 'string'},
            {'internalType': 'string', 'name': 'institution', 'type': 'string'},
            {'internalType': 'uint256', 'name': 'issueDate', 'type': 'uint256'},
            {'internalType': 'uint256', 'name': 'expiryDate', 'type': 'uint256'},
            {'internalType': 'string', 'name': 'ipfsCid', 'type': 'string'},
        ],
        'name': 'issueCredential',
        'outputs': [{'internalType': 'uint256', 'name': '', 'type': 'uint256'}],
        'stateMutability': 'nonpayable',
        'type': 'function',
    },
    {
        'inputs': [{'internalType': 'uint256', 'name': 'credentialId', 'type': 'uint256'}],
        'name': 'verifyCredential',
        'outputs': [
            {'internalType': 'bool', 'name': 'exists', 'type': 'bool'},
            {'internalType': 'bool', 'name': 'valid', 'type': 'bool'},
            {'internalType': 'bool', 'name': 'revoked', 'type': 'bool'},
            {'internalType': 'bool', 'name': 'expired', 'type': 'bool'},
            {'internalType': 'address', 'name': 'candidate', 'type': 'address'},
            {'internalType': 'address', 'name': 'issuer', 'type': 'address'},
            {'internalType': 'string', 'name': 'candidateName', 'type': 'string'},
            {'internalType': 'string', 'name': 'degree', 'type': 'string'},
            {'internalType': 'string', 'name': 'institution', 'type': 'string'},
            {'internalType': 'uint256', 'name': 'issueDate', 'type': 'uint256'},
            {'internalType': 'uint256', 'name': 'expiryDate', 'type': 'uint256'},
            {'internalType': 'string', 'name': 'ipfsCid', 'type': 'string'},
        ],
        'stateMutability': 'view',
        'type': 'function',
    },
    {
        'inputs': [{'internalType': 'uint256', 'name': 'credentialId', 'type': 'uint256'}],
        'name': 'revokeCredential',
        'outputs': [],
        'stateMutability': 'nonpayable',
        'type': 'function',
    },
    {
        'inputs': [{'internalType': 'address', 'name': 'wallet', 'type': 'address'}],
        'name': 'getCredentialIdsByWallet',
        'outputs': [{'internalType': 'uint256[]', 'name': '', 'type': 'uint256[]'}],
        'stateMutability': 'view',
        'type': 'function',
    },
]


def get_web3() -> Web3:
    provider_url = settings.alchemy_mumbai_url or 'http://127.0.0.1:8545'
    web3 = Web3(Web3.HTTPProvider(provider_url))
    if ExtraDataToPOAMiddleware is not None:
        web3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return web3


def get_contract():
    if not settings.contract_address:
        raise HTTPException(status_code=500, detail='CONTRACT_ADDRESS is not configured')
    web3 = get_web3()
    return web3.eth.contract(address=Web3.to_checksum_address(settings.contract_address), abi=CONTRACT_ABI)


def get_account():
    if not settings.private_key:
        raise HTTPException(status_code=500, detail='PRIVATE_KEY is not configured')
    web3 = get_web3()
    return web3.eth.account.from_key(settings.private_key), web3


def _build_tx(function_call, web3: Web3, from_address: str) -> Dict[str, Any]:
    nonce = web3.eth.get_transaction_count(from_address)
    gas_price = web3.eth.gas_price
    return function_call.build_transaction(
        {
            'from': from_address,
            'nonce': nonce,
            'gas': 3_500_000,
            'gasPrice': gas_price,
            'chainId': web3.eth.chain_id,
        }
    )


def _send_transaction(function_call):
    account, web3 = get_account()
    transaction = _build_tx(function_call, web3, account.address)
    signed = account.sign_transaction(transaction)
    raw_transaction = getattr(signed, 'rawTransaction', None) or getattr(signed, 'raw_transaction')
    tx_hash = web3.eth.send_raw_transaction(raw_transaction)
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
    return web3.to_hex(tx_hash), receipt


def register_issuer(issuer_address: str):
    contract = get_contract()
    tx_hash, receipt = _send_transaction(contract.functions.registerIssuer(Web3.to_checksum_address(issuer_address)))
    return {'transaction_hash': tx_hash, 'receipt': receipt}


def issue_credential(payload: Dict[str, Any]):
    contract = get_contract()
    candidate_wallet = Web3.to_checksum_address(payload['candidate_wallet'])
    tx_hash, receipt = _send_transaction(
        contract.functions.issueCredential(
            candidate_wallet,
            payload['candidate_name'],
            payload['degree'],
            payload['institution'],
            int(payload['issue_date']),
            int(payload['expiry_date']),
            payload['ipfs_cid'],
        )
    )
    logs = contract.events.CredentialIssued().process_receipt(receipt)
    credential_id = logs[0]['args']['credentialId'] if logs else None
    return {'transaction_hash': tx_hash, 'credential_id': credential_id}


def revoke_credential(credential_id: int):
    contract = get_contract()
    tx_hash, receipt = _send_transaction(contract.functions.revokeCredential(int(credential_id)))
    return {'transaction_hash': tx_hash, 'receipt': receipt}


def get_wallet_credential_ids(wallet_address: str) -> List[int]:
    contract = get_contract()
    wallet = Web3.to_checksum_address(wallet_address)
    return list(contract.functions.getCredentialIdsByWallet(wallet).call())


def fetch_credential(credential_id: int) -> Dict[str, Any]:
    contract = get_contract()
    record = contract.functions.verifyCredential(int(credential_id)).call()
    return {
        'exists': record[0],
        'valid': record[1],
        'revoked': record[2],
        'expired': record[3],
        'candidate_wallet': record[4],
        'issuer': record[5],
        'candidate_name': record[6],
        'degree': record[7],
        'institution': record[8],
        'issue_date': int(record[9]),
        'expiry_date': int(record[10]),
        'ipfs_cid': record[11],
    }
