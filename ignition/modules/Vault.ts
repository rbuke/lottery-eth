import { ethers } from "hardhat";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const LOTTERY_ADDRESS:string = "0x5FbDB2315678afecb367f032d93F642f64180aa3";



const vaultContract = buildModule("VaultModule", (m) => {
    const vault = m.contract("VaultWallet", [LOTTERY_ADDRESS], {});
    return { vault };
  });
  
  export default vaultContract;