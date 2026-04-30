const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

async function main() {
  try {
    console.log(`Starting deployment on network: ${network.name}`);
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    // ── 1. Deploy StoraToken ──────────────────────────────────────────────
    console.log("\nDeploying StoraToken...");
    const StoraToken = await ethers.getContractFactory("StoraToken");
    const storaToken = await StoraToken.deploy();
    await storaToken.waitForDeployment();
    const tokenAddress = await storaToken.getAddress();
    console.log(`✅ StoraToken deployed to: ${tokenAddress}`);

    // ── 2. Deploy StoraChainStorage ───────────────────────────────────────
    console.log("\nDeploying StoraChainStorage...");
    const StoraChainStorage = await ethers.getContractFactory("StoraChainStorage");
    const storaChainStorage = await StoraChainStorage.deploy();
    await storaChainStorage.waitForDeployment();
    const storageAddress = await storaChainStorage.getAddress();
    console.log(`✅ StoraChainStorage deployed to: ${storageAddress}`);

    // ── 3. Print env var updates ──────────────────────────────────────────
    console.log("\n══════════════════════════════════════════════════");
    console.log("Add these to backend/.env:");
    console.log(`TOKEN_CONTRACT_ADDRESS=${tokenAddress}`);
    console.log(`STORAGE_CONTRACT_ADDRESS=${storageAddress}`);
    console.log("══════════════════════════════════════════════════");
    console.log(`\nSepolia Etherscan:`);
    console.log(`  StoraToken:         https://sepolia.etherscan.io/address/${tokenAddress}`);
    console.log(`  StoraChainStorage:  https://sepolia.etherscan.io/address/${storageAddress}`);

    // ── 4. Write addresses to a JSON file for easy reference ─────────────
    const out = { tokenAddress, storageAddress, network: network.name, deployedAt: new Date().toISOString() };
    fs.writeFileSync(path.resolve(__dirname, "../deployed-addresses.json"), JSON.stringify(out, null, 2));
    console.log("\n📄 Addresses saved to smart-contracts/deployed-addresses.json");

  } catch (error) {
    console.error("❌ Deployment error:");
    console.error(error.message || error);
    process.exit(1);
  }
}

main();
