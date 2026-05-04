// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract ResumeVerifier is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    struct Credential {
        uint256 credentialId;
        address candidate;
        address issuer;
        string candidateName;
        string degree;
        string institution;
        uint256 issueDate;
        uint256 expiryDate;
        string ipfsCid;
        bool revoked;
        bool exists;
    }

    uint256 private credentialCounter;

    mapping(uint256 => Credential) private credentials;
    mapping(address => uint256[]) private credentialIdsByWallet;

    event IssuerRegistered(address indexed issuer, address indexed admin);
    event CredentialIssued(
        uint256 indexed credentialId,
        address indexed candidate,
        address indexed issuer,
        string candidateName,
        string degree,
        string institution,
        string ipfsCid
    );
    event CredentialRevoked(uint256 indexed credentialId, address indexed revokedBy);

    error ZeroAddressNotAllowed();
    error IssuerAlreadyRegistered();
    error CredentialDoesNotExist();
    error CredentialAlreadyRevoked();
    error NotAuthorized();

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }

    modifier onlyAdminOrIssuer() {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender) && !hasRole(ISSUER_ROLE, msg.sender)) {
            revert NotAuthorized();
        }
        _;
    }

    function registerIssuer(address issuer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (issuer == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (hasRole(ISSUER_ROLE, issuer)) {
            revert IssuerAlreadyRegistered();
        }

        _grantRole(ISSUER_ROLE, issuer);
        emit IssuerRegistered(issuer, msg.sender);
    }

    function issueCredential(
        address candidate,
        string calldata candidateName,
        string calldata degree,
        string calldata institution,
        uint256 issueDate,
        uint256 expiryDate,
        string calldata ipfsCid
    ) external onlyRole(ISSUER_ROLE) returns (uint256) {
        if (candidate == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (bytes(ipfsCid).length == 0) {
            revert CredentialDoesNotExist();
        }

        credentialCounter += 1;
        uint256 credentialId = credentialCounter;

        credentials[credentialId] = Credential({
            credentialId: credentialId,
            candidate: candidate,
            issuer: msg.sender,
            candidateName: candidateName,
            degree: degree,
            institution: institution,
            issueDate: issueDate,
            expiryDate: expiryDate,
            ipfsCid: ipfsCid,
            revoked: false,
            exists: true
        });

        credentialIdsByWallet[candidate].push(credentialId);

        emit CredentialIssued(credentialId, candidate, msg.sender, candidateName, degree, institution, ipfsCid);
        return credentialId;
    }

    function verifyCredential(uint256 credentialId)
        external
        view
        returns (
            bool exists,
            bool valid,
            bool revoked,
            bool expired,
            address candidate,
            address issuer,
            string memory candidateName,
            string memory degree,
            string memory institution,
            uint256 issueDate,
            uint256 expiryDate,
            string memory ipfsCid
        )
    {
        Credential memory credential = credentials[credentialId];
        if (!credential.exists) {
            revert CredentialDoesNotExist();
        }

        expired = block.timestamp > credential.expiryDate;
        revoked = credential.revoked;
        exists = credential.exists;
        valid = !revoked && !expired;
        candidate = credential.candidate;
        issuer = credential.issuer;
        candidateName = credential.candidateName;
        degree = credential.degree;
        institution = credential.institution;
        issueDate = credential.issueDate;
        expiryDate = credential.expiryDate;
        ipfsCid = credential.ipfsCid;
    }

    function revokeCredential(uint256 credentialId) external onlyAdminOrIssuer {
        Credential storage credential = credentials[credentialId];
        if (!credential.exists) {
            revert CredentialDoesNotExist();
        }
        if (credential.revoked) {
            revert CredentialAlreadyRevoked();
        }
        if (msg.sender != credential.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotAuthorized();
        }

        credential.revoked = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }

    function getCredentialIdsByWallet(address wallet) external view returns (uint256[] memory) {
        return credentialIdsByWallet[wallet];
    }

    function getCredentialCount() external view returns (uint256) {
        return credentialCounter;
    }
}
