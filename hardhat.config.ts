require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config();
import "@nomicfoundation/hardhat-ignition-ethers";
import "@typechain/hardhat";
import "@nomicfoundation/hardhat-ethers";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: '0.8.20',
  networks: {
    hardhat: {
      chainId: 1337,
    },
    arbitrumSepolia: {
      url: 'https://sepolia-rollup.arbitrum.io/rpc',
      chainId: 421614,
      accounts: [process.env.SEPOLIA_PRIVATE_KEY]
    },
  },
  
  etherscan: {
    apiKey: {
        arbitrumOne: process.env.ARBISCAN_API_KEY,
        arbitrumSepolia: process.env.ARBISCAN_API_KEY,
    },
  }
};