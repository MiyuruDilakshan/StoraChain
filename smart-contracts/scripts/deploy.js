const { ethers, network } = require("hardhat");

async function main() {
  try {
    console.log(`Starting deployment on network: ${network.name}`);

    // Get the contract factory for StoraChainStorage
    const StoraChainStorage = await ethers.getContractFactory("StoraChainStorage");

    console.log("Deploying StoraChainStorage...");
    // Deploy the contract
    const storaChainStorage = await StoraChainStorage.deploy();

    // Wait for the deployment to complete (Ethers v6 syntax used in newer hardhat-toolbox)
    await storaChainStorage.waitForDeployment();

    // Print the deployed contract address
    const contractAddress = await storaChainStorage.getAddress();
    console.log(`✅ StoraChainStorage successfully deployed to: ${contractAddress}`);
    console.log(`Network: ${network.name}`);

  } catch (error) {
    console.error("❌ Error during deployment:");
    console.error(error);
    process.exit(1);
  }
}

// Execute the deployment script
main();
