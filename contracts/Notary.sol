// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title On-chain Notary
 * @notice Minimal notarization contract that stores a file hash -> owner mapping with timestamp.
 */
contract Notary {
    struct Record {
        address owner;
        uint256 timestamp;
    }

    // fileHash (bytes32 or hex string hashed off-chain) -> Record
    mapping(string => Record) private records;

    event DocumentNotarized(address indexed owner, string indexed documentHash, uint256 timestamp);

    /**
     * @notice Notarize a document hash. Reverts if already notarized.
     * @param documentHash The hex string of the document's hash (e.g., SHA-256 hex)
     */
    function notarizeDocument(string calldata documentHash) external {
        require(bytes(documentHash).length > 0, "EMPTY_HASH");
        require(records[documentHash].owner == address(0), "ALREADY_NOTARIZED");

        records[documentHash] = Record({owner: msg.sender, timestamp: block.timestamp});

        emit DocumentNotarized(msg.sender, documentHash, block.timestamp);
    }

    /**
     * @notice Verify a document hash and return the owner address.
     * @param documentHash The hex string of the document's hash
     * @return owner The address that notarized the hash or address(0) if none
     */
    function verifyDocument(string calldata documentHash) external view returns (address owner) {
        return records[documentHash].owner;
    }

    /**
     * @notice Get full record for a document hash.
     */
    function getRecord(string calldata documentHash) external view returns (address owner, uint256 timestamp) {
        Record memory r = records[documentHash];
        return (r.owner, r.timestamp);
    }
}


