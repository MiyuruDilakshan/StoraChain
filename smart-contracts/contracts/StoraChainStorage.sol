// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StoraChainStorage
 * @dev StoraChain – Final Year Project
 *      Decentralized storage registry on Ethereum (Sepolia Testnet).
 *      Records file metadata uploaded by users: CID, filename, size, timestamp.
 */
contract StoraChainStorage {

    // ─── Structs ────────────────────────────────────────────────────────────
    struct FileRecord {
        string  cid;         // IPFS / decentralized storage Content ID
        string  fileName;
        uint256 fileSize;    // bytes
        uint256 timestamp;
        address uploader;
    }

    // ─── State ──────────────────────────────────────────────────────────────
    // Mapping: user address → list of their uploaded file records
    mapping(address => FileRecord[]) private userFiles;

    // Total files stored across all users
    uint256 public totalFilesStored;

    // ─── Events ─────────────────────────────────────────────────────────────
    event FileUploaded(
        address indexed uploader,
        string  cid,
        string  fileName,
        uint256 fileSize,
        uint256 timestamp
    );

    event FileDeleted(
        address indexed uploader,
        string  cid,
        uint256 timestamp
    );

    // ─── Functions ──────────────────────────────────────────────────────────

    /**
     * @notice Store a new file record on-chain.
     * @param _cid       IPFS / storage CID of the file
     * @param _fileName  Display name of the file
     * @param _fileSize  Size of the file in bytes
     */
    function uploadFile(
        string memory _cid,
        string memory _fileName,
        uint256 _fileSize
    ) external {
        require(bytes(_cid).length > 0,      "CID cannot be empty");
        require(bytes(_fileName).length > 0, "Filename cannot be empty");
        require(_fileSize > 0,               "File size must be greater than zero");

        FileRecord memory record = FileRecord({
            cid:       _cid,
            fileName:  _fileName,
            fileSize:  _fileSize,
            timestamp: block.timestamp,
            uploader:  msg.sender
        });

        userFiles[msg.sender].push(record);
        totalFilesStored++;

        emit FileUploaded(msg.sender, _cid, _fileName, _fileSize, block.timestamp);
    }

    /**
     * @notice Get all file records belonging to the caller.
     * @return Array of FileRecord structs
     */
    function getMyFiles() external view returns (FileRecord[] memory) {
        return userFiles[msg.sender];
    }

    /**
     * @notice Get the number of files stored by the caller.
     */
    function getMyFileCount() external view returns (uint256) {
        return userFiles[msg.sender].length;
    }

    /**
     * @notice Delete a file record by index (caller only).
     * @param _index Index in the caller's file array
     */
    function deleteFile(uint256 _index) external {
        FileRecord[] storage files = userFiles[msg.sender];
        require(_index < files.length, "Index out of bounds");

        string memory deletedCid = files[_index].cid;

        // Swap with last element and pop to avoid gaps
        files[_index] = files[files.length - 1];
        files.pop();

        if (totalFilesStored > 0) totalFilesStored--;

        emit FileDeleted(msg.sender, deletedCid, block.timestamp);
    }
}
