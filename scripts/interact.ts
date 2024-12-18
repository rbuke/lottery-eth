import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  // Get the signers
  const [owner, addr1, addr2]: SignerWithAddress[] = await ethers.getSigners();

  console.log("Owner address:", await owner.getAddress());
  console.log("Addr1 address:", await addr1.getAddress());

  // Get the contract factory and deploy
  // Get the contract at the deployed address
  const lottery: Lottery = await ethers.getContractAt(
    "Lottery",
    "0x5FbDB2315678afecb367f032d93F642f64180aa3" 
  );

  // check if draw is open
  const draw = await lottery.connect(addr1).isDrawOpen();
  
  if(!draw.isOpen) {
   await lottery.connect(owner).startNewDraw();
  }
  console.log(draw.status)


  // Get the Ticket Fee
  const price = await lottery.ticketPrice();
  console.log("Ticket price in wei:", ethers.formatEther(price));

  // Get fee  price
  const ticketFee = await lottery.ticketFee();
  console.log("Ticket fee in wei:", ethers.formatEther(ticketFee));

  // buy tickets
  const tx = await lottery.connect(addr1).buyTickets(2, { value: price * BigInt(2) });
  const receipt = await tx.wait();
  console.log(receipt);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
