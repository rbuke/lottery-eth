import { ethers } from "hardhat";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TICKET_PRICE = ethers.parseEther("0.0001");
const FEE_WALLET: string = "0x1b6A5eDd15c92B20837058Ae20A3106aC4778216";
const VAULT_WALLET: string = "0x98AAA33dCDecD3452141342d825e1104830B9369";
const BLOCK_CONFIRMATIONS = 5;


const lotteryContract = buildModule("LockModule", (m) => {
  
    const lottery = m.contract("Lottery", [TICKET_PRICE, FEE_WALLET, VAULT_WALLET], {});
  
    return { lottery };
  });
  
  export default lotteryContract;