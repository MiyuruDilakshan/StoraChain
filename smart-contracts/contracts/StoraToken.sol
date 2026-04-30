// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title StoraToken (SCT)
 * @dev Minimal ERC-20 token for the StoraChain platform.
 *      Only the contract owner (backend deployer wallet) can mint tokens.
 *      Max supply: 100,000,000 SCT.
 */
contract StoraToken {
    // ─── ERC-20 metadata ────────────────────────────────────────────────────
    string  public name     = "StoraChain Token";
    string  public symbol   = "SCT";
    uint8   public decimals = 18;

    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;

    // ─── State ──────────────────────────────────────────────────────────────
    uint256 public totalSupply;
    address public owner;

    mapping(address => uint256)                     public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // ─── Events ─────────────────────────────────────────────────────────────
    event Transfer(address indexed from, address indexed to,    uint256 value);
    event Approval(address indexed owner_, address indexed spender, uint256 value);
    event Minted(address indexed to, uint256 amount);
    event Burned(address indexed from, uint256 amount);

    // ─── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyOwner() {
        require(msg.sender == owner, "SCT: caller is not the owner");
        _;
    }

    // ─── Constructor ────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
    }

    // ─── Mint / Burn ─────────────────────────────────────────────────────────
    /**
     * @notice Mint `amount` SCT to `to`. Only callable by owner.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "SCT: mint to zero address");
        require(totalSupply + amount <= MAX_SUPPLY, "SCT: max supply exceeded");
        totalSupply      += amount;
        balanceOf[to]    += amount;
        emit Transfer(address(0), to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Burn `amount` SCT from caller's balance.
     */
    function burn(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "SCT: insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalSupply           -= amount;
        emit Transfer(msg.sender, address(0), amount);
        emit Burned(msg.sender, amount);
    }

    /**
     * @notice Transfer ownership. Only callable by current owner.
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "SCT: new owner is zero address");
        owner = newOwner;
    }

    // ─── ERC-20 core ─────────────────────────────────────────────────────────
    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(allowance[from][msg.sender] >= amount, "SCT: insufficient allowance");
        allowance[from][msg.sender] -= amount;
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        require(from != address(0), "SCT: transfer from zero address");
        require(to   != address(0), "SCT: transfer to zero address");
        require(balanceOf[from] >= amount, "SCT: insufficient balance");
        balanceOf[from] -= amount;
        balanceOf[to]   += amount;
        emit Transfer(from, to, amount);
    }
}
