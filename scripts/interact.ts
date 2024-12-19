import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  // Get the signers
  const [owner, addr1, addr2, addr3, addr4, addr5]: SignerWithAddress[] = await ethers.getSigners();

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
  const price = await lottery.ticketPrice();
  
  const getPotDetails = await lottery.connect(owner).getPotDetails();
  console.log("Pot Details:\n\nVault Address: ", getPotDetails.vaultAddress)
  console.log("Pot Size: ", getPotDetails.vaultBalance)
  console.log("Tickets Sold: ", getPotDetails.ticketsSold)
  console.log("Draw Time: ", getPotDetails.drawTime)

  // // Buy tickets
  await buyTickets(lottery, 2, addr1, price);
  // await buyTickets(lottery, 4, addr2, price);
  // await buyTickets(lottery, 2, addr3, price);
  // await buyTickets(lottery, 7, addr4, price);
  // await buyTickets(lottery, 9, addr5, price);
  await selectWinner(lottery, owner);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function buyTickets(lottery: Lottery, numberOfTickets: number, buyerAddress: SignerWithAddress, price: bigint) {
    // buy tickets
    console.log("Buying tickets...");
    const tx = await lottery.connect(buyerAddress).buyTickets(numberOfTickets, { value: price * BigInt(numberOfTickets) });
    const receipt = await tx.wait();
    receipt?.logs.forEach(log => {
      const decodedLog = lottery.interface.parseLog(log);
      if (!decodedLog) return;
      console.log("Event Name:", decodedLog.name);
      console.log("Event Inputs:", decodedLog.fragment.inputs);
      console.log("Event Args:", decodedLog.args);
    });
}

async function selectWinner(lottery: Lottery, owner: SignerWithAddress) {
  const tx = await lottery.connect(owner).selectWinner();
  const receipt = await tx.wait();
  console.log( "Selecting Winner: \n \n", receipt);
}

async function getPotDetails(lottery: Lottery, owner: SignerWithAddress) {
  const details = await lottery.connect(owner).getPotDetails();
  console.log( "Pot Details: \n \n", details);
}
