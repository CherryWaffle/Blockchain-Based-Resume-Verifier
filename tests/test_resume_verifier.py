import pytest
from brownie import ResumeVerifier, accounts, chain, reverts


@pytest.fixture
def admin():
    return accounts[0]


@pytest.fixture
def issuer():
    return accounts[1]


@pytest.fixture
def candidate():
    return accounts[2]


@pytest.fixture
def contract(admin):
    return ResumeVerifier.deploy({'from': admin})


@pytest.fixture
def registered_issuer(contract, admin, issuer):
    tx = contract.registerIssuer(issuer, {'from': admin})
    assert tx.events['IssuerRegistered']['issuer'] == issuer
    return issuer


@pytest.fixture
def issued_credential(contract, registered_issuer, candidate, issuer):
    tx = contract.issueCredential(
        candidate,
        'Jane Candidate',
        'Bachelor of Science',
        'Blockchain University',
        chain.time(),
        chain.time() + 365 * 24 * 60 * 60,
        'QmTestCid123',
        {'from': issuer},
    )
    credential_id = tx.return_value
    return credential_id


def test_admin_can_register_issuer(contract, admin, issuer):
    tx = contract.registerIssuer(issuer, {'from': admin})
    assert tx.events['IssuerRegistered']['issuer'] == issuer
    assert contract.hasRole(contract.ISSUER_ROLE(), issuer)


def test_non_admin_cannot_register_issuer(contract, issuer):
    with reverts():
        contract.registerIssuer(issuer, {'from': issuer})


def test_cannot_register_zero_address(contract, admin):
    with reverts():
        contract.registerIssuer('0x0000000000000000000000000000000000000000', {'from': admin})


def test_cannot_register_same_issuer_twice(contract, admin, issuer):
    contract.registerIssuer(issuer, {'from': admin})
    with reverts():
        contract.registerIssuer(issuer, {'from': admin})


def test_only_issuer_can_issue_credential(contract, candidate, issuer):
    with reverts():
        contract.issueCredential(
            candidate,
            'Jane Candidate',
            'Bachelor of Science',
            'Blockchain University',
            chain.time(),
            chain.time() + 365,
            'QmTestCid123',
            {'from': issuer},
        )


def test_issue_credential_stores_full_record(contract, registered_issuer, candidate, issuer):
    tx = contract.issueCredential(
        candidate,
        'Jane Candidate',
        'Bachelor of Science',
        'Blockchain University',
        chain.time(),
        chain.time() + 365 * 24 * 60 * 60,
        'QmTestCid123',
        {'from': issuer},
    )
    credential_id = tx.return_value
    assert tx.events['CredentialIssued']['credentialId'] == credential_id

    record = contract.verifyCredential(credential_id)
    assert record[0] is True
    assert record[1] is True
    assert record[2] is False
    assert record[3] is False
    assert record[4] == candidate
    assert record[5] == issuer
    assert record[6] == 'Jane Candidate'
    assert record[7] == 'Bachelor of Science'
    assert record[8] == 'Blockchain University'
    assert record[12] == 'QmTestCid123'

    wallet_ids = contract.getCredentialIdsByWallet(candidate)
    assert wallet_ids[0] == credential_id


def test_issue_credential_rejects_zero_candidate(contract, registered_issuer, issuer):
    with reverts():
        contract.issueCredential(
            '0x0000000000000000000000000000000000000000',
            'Jane Candidate',
            'Bachelor of Science',
            'Blockchain University',
            chain.time(),
            chain.time() + 365,
            'QmTestCid123',
            {'from': issuer},
        )


def test_verify_missing_credential_reverts(contract):
    with reverts():
        contract.verifyCredential(999)


def test_revoke_credential_marks_record_revoked(contract, issued_credential, issuer):
    tx = contract.revokeCredential(issued_credential, {'from': issuer})
    assert tx.events['CredentialRevoked']['credentialId'] == issued_credential

    record = contract.verifyCredential(issued_credential)
    assert record[1] is False
    assert record[2] is True


def test_admin_can_revoke_credential(contract, registered_issuer, candidate, issuer, admin):
    tx = contract.issueCredential(
        candidate,
        'Jane Candidate',
        'Bachelor of Science',
        'Blockchain University',
        chain.time(),
        chain.time() + 365,
        'QmTestCid123',
        {'from': issuer},
    )
    credential_id = tx.return_value

    revoke_tx = contract.revokeCredential(credential_id, {'from': admin})
    assert revoke_tx.events['CredentialRevoked']['credentialId'] == credential_id


def test_cannot_revoke_twice(contract, issued_credential, issuer):
    contract.revokeCredential(issued_credential, {'from': issuer})
    with reverts():
        contract.revokeCredential(issued_credential, {'from': issuer})


def test_expired_credential_reports_invalid(contract, registered_issuer, candidate, issuer):
    credential_id = contract.issueCredential(
        candidate,
        'Jane Candidate',
        'Bachelor of Science',
        'Blockchain University',
        chain.time(),
        chain.time() + 1,
        'QmExpiredCid',
        {'from': issuer},
    ).return_value

    chain.sleep(2)
    chain.mine(1)

    record = contract.verifyCredential(credential_id)
    assert record[1] is False
    assert record[3] is True


def test_get_credential_count(contract, registered_issuer, candidate, issuer):
    assert contract.getCredentialCount() == 0
    contract.issueCredential(
        candidate,
        'Jane Candidate',
        'Bachelor of Science',
        'Blockchain University',
        chain.time(),
        chain.time() + 365,
        'QmCountCid',
        {'from': issuer},
    )
    assert contract.getCredentialCount() == 1
