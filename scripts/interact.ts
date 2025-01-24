import { ethers } from "hardhat";
import { Lottery, VaultWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  // Get the signers
  const [owner, vaultholder, addr2, addr3, addr4, addr5, addr6]: SignerWithAddress[] = await ethers.getSigners();

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
  const draw = await lottery.connect(addr2).isDrawOpen();

  
  if(!draw.isOpen) {
   await lottery.connect(owner).startNewDraw();
  }

  // console.log(draw.status)
  const price = await lottery.ticketPrice();
  console.log("Ticket Price in ETH:", ethers.formatEther(price));

  // Get current round ID
  const currentRoundId = await lottery.currentRoundId();
  console.log("Current Round ID:", currentRoundId.toString());

  // Loop through all rounds
  for (let i = 0; i < currentRoundId; i++) {
    try {
      const winner = await lottery.winners(i);
      
      // Only logs if there's a valid winner (address isn't zero and prize is greater than 0)
      if (winner.winner !== ethers.ZeroAddress) {
        console.log({
          roundId: i,
          winner: winner.winner,
          prize: ethers.formatEther(winner.prize) + " ETH"
        });
      }
    } catch (error) {
      console.log(`No winner for round ${i}`);
    }
  }
  // // // buy tickets
  // await buyTickets(lottery, 10, addr2, price);
  // await buyTickets(lottery, 47, addr6, price);
  // await buyTickets(lottery, 3, addr3, price);
  // await buyTickets(lottery, 62, addr4, price);
  // await buyTickets(lottery, 2, addr5, price);

  const myTickets = await lottery.connect(addr6).viewTickets();
  const [ currentBalance ] = await lottery.getPotDetails();
  console.log("Current Balance: Eth", ethers.formatEther(currentBalance));
  

  //  // select winner
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
