// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StoraChainStorage
 * @dev StoraChain – Final Year Project
 *      Decentralized storage registry on Ethereum (Sepolia Testnet).
 *      Records file metadata, provider assignments, downloads, and reward cycles.
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
    mapping(address => FileRecord[]) private userFiles;
    uint256 public totalFilesStored;

    // ─── Events (legacy) ────────────────────────────────────────────────────
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

    // ─── Events (new) ───────────────────────────────────────────────────────

    /**
     * @dev Emitted by storeFile() — full provider assignment record.
     */
    event FileStored(
        bytes32 indexed fileHash,
        string          cid,
        address indexed seekerWallet,
        address[]       providerWallets,
        uint256         fileSize,
        uint256         timestamp
    );

    /**
     * @dev Emitted by recordDownload().
     */
    event FileDownloaded(
        bytes32 indexed fileHash,
        address indexed downloader,
        uint256         timestamp
    );

    /**
     * @dev Emitted by recordReward() for each provider paid in a reward cycle.
     */
    event RewardDistributed(
        address indexed providerWallet,
        uint256         amountSCT,
        uint256         timestamp
    );

    // ─── Functions (legacy) ─────────────────────────────────────────────────

    /**
     * @notice Store a new file record on-chain (legacy — seeker is msg.sender).
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

    function getMyFiles() external view returns (FileRecord[] memory) {
        return userFiles[msg.sender];
    }

    function getMyFileCount() external view returns (uint256) {
        return userFiles[msg.sender].length;
    }

    function deleteFile(uint256 _index) external {
        FileRecord[] storage files = userFiles[msg.sender];
        require(_index < files.length, "Index out of bounds");

        string memory deletedCid = files[_index].cid;

        files[_index] = files[files.length - 1];
        files.pop();

        if (totalFilesStored > 0) totalFilesStored--;

        emit FileDeleted(msg.sender, deletedCid, block.timestamp);
    }

    // ─── Functions (new) ────────────────────────────────────────────────────

    /**
     * @notice Record a full file upload with provider assignments.
     * @param fileHash        SHA-256 hash of the original plaintext (as bytes32)
     * @param cid             IPFS / Pinata CID of the encrypted file
     * @param seekerWallet    Wallet address of the file owner / uploader
     * @param providerWallets Array of provider wallet addresses that store chunks
     * @param fileSize        Size of the original file in bytes
     */
    function storeFile(
        bytes32         fileHash,
        string  memory  cid,
        address         seekerWallet,
        address[] memory providerWallets,
        uint256         fileSize
    ) external {
        require(fileHash  != bytes32(0),       "fileHash cannot be zero");
        require(fileSize  >  0,                "fileSize must be > 0");
        require(seekerWallet != address(0),    "invalid seeker wallet");

        totalFilesStored++;

        emit FileStored(
            fileHash,
            cid,
            seekerWallet,
            providerWallets,
            fileSize,
            block.timestamp
        );
    }

    /**
     * @notice Record a file download event.
     * @param fileHash   SHA-256 hash identifying the file
     * @param downloader Wallet address of the downloader
     */
    function recordDownload(bytes32 fileHash, address downloader) external {
        require(fileHash   != bytes32(0),   "fileHash cannot be zero");
        require(downloader != address(0),   "invalid downloader address");

        emit FileDownloaded(fileHash, downloader, block.timestamp);
    }

    /**
     * @notice Emit reward distribution event for a provider.
     * @param providerWallet Provider wallet that received SCT
     * @param amountSCT      Amount of SCT minted (in wei units)
     */
    function recordReward(address providerWallet, uint256 amountSCT) external {
        require(providerWallet != address(0), "invalid provider wallet");
        emit RewardDistributed(providerWallet, amountSCT, block.timestamp);
    }
}

