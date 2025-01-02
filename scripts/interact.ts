import { ethers } from "hardhat";
import { Lottery, VaultWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  // Get the signers
  const [owner, addr1, addr2, addr3, addr4, addr5]: SignerWithAddress[] = await ethers.getSigners();

  // Create the vault contract
  const vault: VaultWallet = await ethers.getContractAt(
    "VaultWallet",
    "0x5fbdb2315678afecb367f032d93f642f64180aa3" 
  );
  // Get the lottery contract
  const lottery: Lottery = await ethers.getContractAt(
    "Lottery",
    "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" 
  );

  // Set the lottery contract address
  await vault.connect(owner).initialize("0xe7f1725e7734ce288f8367e1bb143e90bb3f0512");



  // check if draw is open
  const draw = await lottery.connect(addr1).isDrawOpen();

  
  if(!draw.isOpen) {
   await lottery.connect(owner).startNewDraw();
  }

  // console.log(draw.status)
  const price = await lottery.ticketPrice();
  console.log("Ticket Price in ETH:", ethers.formatEther(price));

  // const potDetails = await lottery.getPotDetails();
  // console.log("Pot Details:");
  // console.log("Current Balance:", ethers.formatEther(potDetails.currentBalance));
  // console.log("Tickets Sold:", potDetails.ticketsSold);
  // console.log("Start Time:", new Date(Number(potDetails.startTime) * 1000).toLocaleString());
  // console.log("End Time:", new Date(Number(potDetails.endTime) * 1000).toLocaleString());
  // console.log("Draw Time:", new Date(Number(potDetails.drawTime) * 1000).toLocaleString());
  // console.log("Time Remaining:", potDetails.timeRemaining);
  // console.log("Is Finalized:", potDetails.isFinalized);
  // console.log("Winner:", potDetails.winner);


  // // // buy tickets
  // await buyTickets(lottery, 1, addr1, price);
  // await buyTickets(lottery, 4, addr2, price);
  // await buyTickets(lottery, 5, addr3, price);
  // await buyTickets(lottery, 6, addr4, price);
  // await buyTickets(lottery, 2, addr5, price);

  // // select winner
  // await selectWinner(lottery, owner);

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
