from brownie import ResumeVerifier, accounts, network
import os


def _load_deployer():
    private_key = os.getenv('PRIVATE_KEY')
    if private_key:
        return accounts.add(private_key)
    return accounts[0]


def main():
    deployer = _load_deployer()
    contract = ResumeVerifier.deploy({'from': deployer})
    print(f'Deployed ResumeVerifier to {contract.address} on {network.show_active()}')
    return contract
