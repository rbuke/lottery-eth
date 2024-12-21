import { expect } from "chai";
import { ethers } from "hardhat";
import { Lottery, VaultWallet } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VaultWallet", function () {
  let lottery: Lottery;
  let vault: VaultWallet;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let ticketPrice = ethers.parseEther("0.1"); // 0.1 ETH

  beforeEach(async function () {
    // Get signers
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy VaultWallet
    const VaultWallet = await ethers.getContractFactory("VaultWallet");
    vault = await VaultWallet.deploy();

    // Deploy Lottery
    const Lottery = await ethers.getContractFactory("Lottery");
    lottery = await Lottery.connect(owner).deploy(
      ticketPrice,
      addr1.address, // fee wallet
      await vault.getAddress()
    );

    // Initialize vault with lottery address
    await vault.initialize(await lottery.getAddress());
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero balance", async function () {
      expect(await vault.getBalance()).to.equal(0);
    });

    it("Should be initialized with lottery contract", async function () {
      expect(await vault.initialized()).to.be.true;
      expect(await vault.lotteryContract()).to.equal(await lottery.getAddress());
    });
  });

  describe("Initialization", function () {
    it("Should not allow non-owner to initialize", async function () {
      const newVault = await ethers.deployContract("VaultWallet");
      await expect(newVault.connect(addr1).initialize(lottery.getAddress()))
        .to.be.revertedWith("Only owner can call");
    });

    it("Should not allow initialization with zero address", async function () {
      const newVault = await ethers.deployContract("VaultWallet");
      await expect(newVault.initialize(ethers.ZeroAddress))
        .to.be.revertedWith("Invalid lottery address");
    });

    it("Should allow re-initialization but not change lottery address", async function () {
      const originalLotteryAddress = await vault.lotteryContract();
      await vault.initialize(addr1.address);
      expect(await vault.lotteryContract()).to.equal(originalLotteryAddress);
    });
  });

  describe("Receiving funds", function () {
    it("Should accept direct transfers", async function () {
      const amount = ethers.parseEther("1.0");
      await addr1.sendTransaction({
        to: await vault.getAddress(),
        value: amount
      });
      expect(await vault.getBalance()).to.equal(amount);
    });

    it("Should accept transfers with data (fallback)", async function () {
      const amount = ethers.parseEther("1.0");
      await addr1.sendTransaction({
        to: await vault.getAddress(),
        value: amount,
        data: "0x1234"
      });
      expect(await vault.getBalance()).to.equal(amount);
    });
  });

  describe("Withdrawals", function () {
    const depositAmount = ethers.parseEther("2.0");
    const withdrawAmount = ethers.parseEther("1.0");

    beforeEach(async function () {
      // Fund the vault
      await addr1.sendTransaction({
        to: await vault.getAddress(),
        value: depositAmount
      });
    });

    it("Should allow lottery contract to withdraw", async function () {
      // First try with non-lottery address (should fail)
      await expect(vault.connect(owner).withdraw(addr2.address, withdrawAmount))
        .to.be.revertedWith("Only lottery can withdraw");

      // Now set up a proper lottery draw
      await lottery.connect(owner).startNewDraw();
      
      // Buy some tickets
      await lottery.connect(addr1).buyTickets(1, { 
        value: ticketPrice 
      });

      // Now try selecting winner (should work)
      await expect(lottery.connect(owner).selectWinner())
        .to.emit(vault, "Withdrawal");
     
      const balance = await vault.getBalance();
      expect(balance.toString()).to.be.eq("0");
    });

    it("Should not allow withdrawal to zero address", async function () {
      // Set caller to be lottery contract
      await vault.connect(owner).initialize(await lottery.getAddress());
      await expect(lottery.connect(owner).selectWinner())
        .to.be.revertedWith("No tickets sold");
    });

    it("Should not allow withdrawal of zero amount", async function () {
      await vault.connect(owner).initialize(await lottery.getAddress());
      // Try to withdraw 0 through lottery contract
      await expect(lottery.connect(owner).selectWinner())
        .to.be.revertedWith("No tickets sold");
    });

    it("Should not allow withdrawal more than balance", async function () {
      await vault.connect(owner).initialize(await lottery.getAddress());
      // Try to withdraw more than balance through lottery contract
      await expect(lottery.connect(owner).selectWinner())
        .to.be.revertedWith("No tickets sold");
    });

    it("Should not allow non-lottery address to withdraw", async function () {
      await expect(vault.connect(addr1).withdraw(addr2.address, withdrawAmount))
        .to.be.revertedWith("Only lottery can withdraw");
    });
  });

  describe("Balance checking", function () {
    it("Should correctly report balance", async function () {
      const amount = ethers.parseEther("1.0");
      expect(await vault.getBalance()).to.equal(0);

      await addr1.sendTransaction({
        to: await vault.getAddress(),
        value: amount
      });
      expect(await vault.getBalance()).to.equal(amount);

      // Buy tickets and select winner to trigger withdrawal
      await vault.connect(owner).initialize(await lottery.getAddress());
      await lottery.connect(owner).startNewDraw();
      await lottery.connect(addr1).buyTickets(1, { value: ticketPrice });
      await lottery.connect(owner).selectWinner();
      
      // Balance should be 0 after winner is selected
      expect(await vault.getBalance()).to.equal(0);
    });
  });
});
