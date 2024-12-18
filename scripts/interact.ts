import { ethers } from "hardhat";
import { Lottery } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { ContractEvent  } from "ethers";

async function main() {
  // Get the signers
  const [owner, addr1, addr2]: SignerWithAddress[] = await ethers.getSigners();

  console.log("Owner address:", await owner.getAddress());
  console.log("Addr1 address:", await addr1.getAddress());

  // Get the contract factory and deploy
  // Get the contract at the deployed address
  const lottery: Lottery = await ethers.getContractAt(
    "Lottery",
    "0x5fbdb2315678afecb367f032d93f642f64180aa3" 
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

  // Buy tickets as addr1
  const buyTx = await lottery.connect(addr1).buyTickets(1, {
    value: price
  });
  await buyTx.wait();
 

}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { Contract } from "@ethersproject/contracts";
import { Signer } from "@ethersproject/abstract-signer";
import { parseEther } from "ethers";


async function buyTickets(
  lottery: Contract, 
  numberOfTickets: number,
  buyerAddress: Signer
) {
  // Define return type
  type TicketPurchaseResult = {
      hash: string;
      buyer: string;
      ticketCount: string;
      roundId: string;
  }

  try {
      const ticketPrice = await lottery.ticketPrice();
      const totalCost = ticketPrice * BigInt(numberOfTickets);

      const tx = await lottery.connect(buyerAddress).buyTickets(numberOfTickets, { value: totalCost });
      const receipt = await tx.wait();
      const event = receipt.events?.find((e: Event) => e.event === 'TicketsPurchased');

      const result: TicketPurchaseResult = {
          hash: tx.hash,
          buyer: event.args[1],
          ticketCount: event.args[2].toString(),
          roundId: event.args[0].toString()
      };

      return result;
  } catch (error) {
      console.error("Error buying tickets:", error);
      throw error;
  }
}