require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
// Load backend .env so SEPOLIA_RPC_URL and PRIVATE_KEY are available
require("dotenv").config({ path: path.resolve(__dirname, "../backend/.env") });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [`0x${process.env.PRIVATE_KEY.replace(/^0x/, '')}`] : [],
    },
  },
};
