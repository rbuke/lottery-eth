import { expect } from "chai";
import { ethers } from "hardhat";
import { Lottery, VaultWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import "@nomicfoundation/hardhat-chai-matchers";

describe("Lottery", function () {
  let lottery: Lottery;
  let vault: VaultWallet;
  let owner: SignerWithAddress;
  let feeWallet: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let ticketPrice = ethers.parseEther("0.1"); // 0.1 ETH

  beforeEach(async function () {
    [owner, feeWallet, addr1, addr2] = await ethers.getSigners();

    // Deploy Vault
    const VaultFactory = await ethers.getContractFactory("VaultWallet");
    vault = await VaultFactory.deploy();

    // Deploy Lottery
    const LotteryFactory = await ethers.getContractFactory("Lottery");
    lottery = await LotteryFactory.deploy(
      ticketPrice,
      feeWallet.address,
      await vault.getAddress()
    );

    // Initialize vault with lottery address
    await vault.initialize(await lottery.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await lottery.owner()).to.equal(owner.address);
    });

    it("Should set the correct ticket price", async function () {
      expect(await lottery.ticketPrice()).to.equal(ticketPrice);
    });

    it("Should set the correct fee wallet", async function () {
      expect(await lottery.feeWallet()).to.equal(feeWallet.address);
    });
  });

  describe("Draw Management", function () {
    it("Should start a new draw", async function () {
      await lottery.startNewDraw();
      const isOpen = await lottery.isDrawOpen();
      expect(isOpen.isOpen).to.be.true;
    });

    it("Should not allow non-owner to start draw", async function () {
      await expect(
        lottery.connect(addr1).startNewDraw()
      ).to.be.revertedWith("Not the owner");
    });

    it("Should not start new draw if previous not finalized", async function () {
      await lottery.startNewDraw();
      await expect(
        lottery.startNewDraw()
      ).to.be.revertedWith("Round already started");
    });
  });

  describe("Ticket Purchases", function () {
    beforeEach(async function () {
      await lottery.startNewDraw();
    });

    it("Should allow ticket purchase", async function () {
      const tickets = 1;
      await lottery.connect(addr1).buyTickets(tickets, {
        value: ticketPrice * BigInt(tickets)
      });
      
      const potDetails = await lottery.getPotDetails();
      expect(potDetails.ticketsSold).to.equal(tickets);
    });

    it("Should reject insufficient payment", async function () {
      await expect(
        lottery.connect(addr1).buyTickets(1, {
          value: ethers.parseEther("0.01")
        })
      ).to.be.revertedWith("Insufficient payment");
    });

    it("Should distribute fees correctly", async function () {
      const initialBalance = await ethers.provider.getBalance(feeWallet.address);
      await lottery.connect(addr1).buyTickets(1, {
        value: ticketPrice
      });
      const finalBalance = await ethers.provider.getBalance(feeWallet.address);
      expect(finalBalance - initialBalance).to.equal(ticketPrice * BigInt(5) / BigInt(100));
    });
  });

  describe("Winner Selection", function () {
    beforeEach(async function () {
      await lottery.startNewDraw();
      await lottery.connect(addr1).buyTickets(1, {
        value: ticketPrice
      });
    });

    it("Should select winner", async function () {
      await lottery.selectWinner();
      const potDetails = await lottery.getPotDetails();
      expect(potDetails.isFinalized).to.be.true;
      expect(potDetails.winner).to.not.equal(ethers.ZeroAddress);
    });

    it("Should not allow non-owner to select winner", async function () {
      await expect(
        lottery.connect(addr1).selectWinner()
      ).to.be.revertedWith("Not the owner");
    });

    it("Should not select winner if no tickets sold", async function () {
      await lottery.startNewDraw();
      await expect(
        lottery.selectWinner()
      ).to.be.revertedWith("No tickets sold");
    });
  });

  describe("View Functions", function () {
    it("Should return correct pot details", async function () {
      await lottery.startNewDraw();
      const potDetails = await lottery.getPotDetails();
      expect(potDetails.ticketsSold).to.equal(0);
      expect(potDetails.isFinalized).to.be.false;
    });

    it("Should return correct ticket count", async function () {
      await lottery.startNewDraw();
      await lottery.connect(addr1).buyTickets(2, {
        value: ticketPrice * BigInt(2)
      });
      const tickets = await lottery.connect(addr1).viewTickets();
      expect(tickets.playerTickets).to.equal(2);
    });
  });

  describe("Admin Functions", function () {
    it("Should update ticket price", async function () {
      const newPrice = ethers.parseEther("0.2");
      await lottery.updateTicketPrice(newPrice);
      expect(await lottery.ticketPrice()).to.equal(newPrice);
    });

    it("Should update fee wallet", async function () {
      await lottery.setFeeWallet(addr1.address);
      expect(await lottery.feeWallet()).to.equal(addr1.address);
    });

    it("Should update vault wallet", async function () {
      const newVault = await (await ethers.getContractFactory("VaultWallet")).deploy();
      await lottery.setVaultWallet(await newVault.getAddress());
      expect(await lottery.vaultWallet()).to.equal(await newVault.getAddress());
    });
  });
});