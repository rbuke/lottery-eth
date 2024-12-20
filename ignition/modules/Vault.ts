import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const vaultContract = buildModule("VaultModule", (m) => {
    const vault = m.contract("VaultWallet", [], {});
    return { vault };
  });
  
  export default vaultContract;