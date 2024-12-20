// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Vault Wallet to hold prize pool
// Only the lottery contract can withdraw funds, and only when the draw is open
// The owner cannot withdraw funds from the vault

contract VaultWallet {
    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////// VARIABLE DECLARATION /////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    address public lotteryContract;
    address public owner;
    bool public initialized;

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// MODIFIERS /////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call");
        _;
    }

    modifier onlyLottery() {
        require(msg.sender == lotteryContract, "Only lottery can withdraw");
        _;
    }

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////////// CONSTRUCTOR ///////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    constructor() payable {
        owner = msg.sender;
    }


    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////////// EVENTS ////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    event Withdrawal(address indexed to, uint256 amount);
    event Initialized(address indexed lotteryContract);

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////////// FUNCTIONS /////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Allow deposits
    receive() external payable {}

    // Optional: Add fallback to handle accidental calls with data
    fallback() external payable {}

    // Get vault balance
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    // Withdraw funds
    function withdraw(address winner, uint256 amount) external onlyLottery {
        require(winner != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = payable(winner).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(winner, amount);
    }

    // Initialize or update lottery contract address
    function initialize(address _lotteryContract) external onlyOwner {
        require(_lotteryContract != address(0), "Invalid lottery address");
        
        if (initialized) {
            emit Initialized(_lotteryContract);
            return;  // Silently return if already initialized
        }
        
        lotteryContract = _lotteryContract;
        initialized = true;
        emit Initialized(_lotteryContract);
    }
}
