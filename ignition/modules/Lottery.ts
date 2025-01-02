import { ethers } from "hardhat";
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TICKET_PRICE = ethers.parseEther("0.0001");
const FEE_WALLET: string = "0x16e47b984E12B71aAC2c57Ff797083A923e71d3f"; 
const VAULT_WALLET: string = "0x5fbdb2315678afecb367f032d93f642f64180aa3";


const lotteryContract = buildModule("LotteryModule", (m) => {
    const lottery = m.contract("Lottery", [TICKET_PRICE, FEE_WALLET, VAULT_WALLET], {});
    return { lottery };
  });
  
  export default lotteryContract;