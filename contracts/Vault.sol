// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// Vault Wallet to hold prize pool
// Only the lottery contract can withdraw funds, and only when the draw is open
// The owner cannot withdraw funds from the vault

contract VaultWallet {
    address public immutable lotteryContract;

    constructor(address _lotteryContract) payable {
        require(_lotteryContract != address(0), "Invalid lottery address");
        lotteryContract = _lotteryContract;
    }

    modifier onlyLottery() {
        require(msg.sender == lotteryContract, "Only lottery can withdraw");
        _;
    }

    // Allow deposits
    receive() external payable {}

    // Optional: Add fallback to handle accidental calls with data
    fallback() external payable {}

    // Get vault balance
    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    // Withdraw funds
    function withdraw(address to, uint256 amount) external onlyLottery {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be greater than 0");
        require(amount <= address(this).balance, "Insufficient balance");
        
        (bool success, ) = payable(to).call{value: amount}("");
        require(success, "Transfer failed");
        
        emit Withdrawal(to, amount);
    }
    
    event Withdrawal(address indexed to, uint256 amount);
}
