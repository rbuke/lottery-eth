// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract Lottery {

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////// VARIABLE DECLARATION /////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    address public owner;
    address public feeWallet;     // Wallet to receive fees
    address public vaultWallet;   // Vault to hold prize pool
    uint256 public ticketPrice;   // cost of entry
    uint256 public ticketFee;
    uint256 public currentRoundId;

    bool private locked;
    
    struct Round {
        uint256 startTime;
        uint256 endTime;
        uint256 drawTime;
        address winner;
        uint256 prize;
        bool finalized;
    }
    
   
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => address[]) public roundParticipants;
    mapping(uint256 => mapping(address => uint256)) public ticketCount;
    
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////// EVENTS //////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);
    event VaultWalletUpdated(address indexed oldVault, address indexed newVault);
    event TicketsPurchased(uint256 roundId, address indexed buyer, uint256 amount, uint256 fee, uint256 toVault);
    event PrizeDistributed(uint256 roundId, address indexed winner, uint256 prize);
    event FeeDistributed(uint256 roundId, address indexed feeWallet, uint256 amount);
    event TicketPriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp);
    

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// MODIFIERS /////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    modifier nonReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
    

    ////////////////////////////////////////////////////////////////////////////
    /////////////////////////// CONSTRUCTOR ////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    constructor(uint256 _ticketPrice, address _feeWallet, address _vaultWallet) payable {
        require(_feeWallet != address(0), "Invalid fee wallet address");
        require(_vaultWallet != address(0), "Invalid vault wallet address");
        require(_ticketPrice > 0, "Ticket price must be greater than 0");
        
        owner = msg.sender;
        feeWallet = _feeWallet;
        vaultWallet = _vaultWallet;
        ticketPrice = _ticketPrice;
        ticketFee = (_ticketPrice * 5) / 100;
    }
    
    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// OWNER FUNCTIONS ///////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Set fee receiving wallet
    function setFeeWallet(address _newFeeWallet) external onlyOwner {
        require(_newFeeWallet != address(0), "Invalid fee wallet address");
        address oldWallet = feeWallet;
        feeWallet = _newFeeWallet;
        emit FeeWalletUpdated(oldWallet, _newFeeWallet);
    }
    
    // Set prize vault wallet
    function setVaultWallet(address _newVaultWallet) external onlyOwner {
        require(_newVaultWallet != address(0), "Invalid vault address");
        address oldVault = vaultWallet;
        vaultWallet = _newVaultWallet;
        emit VaultWalletUpdated(oldVault, _newVaultWallet);
    }

    // Only owner can update price
    function updateTicketPrice(uint256 _newPrice) external onlyOwner {
        require(_newPrice > 0, "Price must be greater than 0");
        uint256 _oldPrice = ticketPrice;
        ticketPrice = _newPrice;
        emit TicketPriceUpdated( _oldPrice, _newPrice, block.timestamp);
    }

    function startNewDraw() external onlyOwner {
        // If not first round, check previous round is finalized
        if (currentRoundId > 0) {
            require(rounds[currentRoundId - 1].finalized, "Previous round not finalized");
        }

        // Get current round
        Round storage currentRound = rounds[currentRoundId];
        require(currentRound.startTime == 0, "Round already started");

        // Set round timestamps
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + 7 days;     // 7 day lottery period
        uint256 drawTime = endTime + 1 hours;     // 1 hour buffer for drawing

        // Initialize new round
        currentRound.startTime = startTime;
        currentRound.endTime = endTime;
        currentRound.drawTime = drawTime;
        currentRound.winner = address(0);
        currentRound.prize = 0;
        currentRound.finalized = false;
    }

        // Modified selectWinner to draw from vault
    function selectWinner() external onlyOwner nonReentrant {
        Round storage currentRound = rounds[currentRoundId];
        require(!currentRound.finalized, "Round already finalized");
        // require(block.timestamp >= currentRound.drawTime, "Too early for draw");
        require(roundParticipants[currentRoundId].length > 0, "No participants");
        
        // Select winner
        uint256 totalTickets;
        address[] storage participants = roundParticipants[currentRoundId];
        
        for (uint i = 0; i < participants.length; i++) {
            totalTickets += ticketCount[currentRoundId][participants[i]];
        }
        
        uint256 winningTicket = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1)
                )
            )
        ) % totalTickets;
        
        address winner;
        uint256 ticketSum;
        for (uint i = 0; i < participants.length; i++) {
            ticketSum += ticketCount[currentRoundId][participants[i]];
            if (ticketSum > winningTicket) {
                winner = participants[i];
                break;
            }
        }
        
        currentRound.winner = winner;
        currentRound.finalized = true;
        
        currentRoundId += 1;
        
        // Transfer prize from vault to winner
        (bool success, ) = payable(winner).call{value: vaultWallet.balance}("");
        require(success, "Failed to send prize to winner");
        
        emit PrizeDistributed(currentRoundId - 1, winner, vaultWallet.balance);
    }
    
    
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////// PAYABLE FUNCTIONS ///////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Buy a ticket
    function buyTickets(uint256 _numberOfTickets) external payable nonReentrant {
        Round storage currentRound = rounds[currentRoundId];
        require(block.timestamp >= currentRound.startTime, "Lottery hasn't started");
        require(block.timestamp <= currentRound.endTime, "Lottery has ended");
        require(_numberOfTickets > 0, "Must buy at least one ticket");
        
        // Calculate required payment
        uint256 requiredAmount = ticketPrice * _numberOfTickets;
        require(msg.value >= requiredAmount, "Insufficient payment");
        
        // Calculate fee and vault amounts
        uint256 feeAmount = (requiredAmount * 5) / 100;    // 5% fee
        uint256 vaultAmount = requiredAmount - feeAmount;   // 95% to vault
        
        // Send fee to fee wallet
        (bool feeSuccess, ) = payable(feeWallet).call{value: feeAmount}("");
        require(feeSuccess, "Failed to send fee to fee wallet");
        
        // Send prize money to vault
        (bool vaultSuccess, ) = payable(vaultWallet).call{value: vaultAmount}("");
        require(vaultSuccess, "Failed to send to vault");
        
        // Return excess payment if any
        uint256 excess = msg.value - requiredAmount;
        if (excess > 0) {
            (bool refundSuccess, ) = payable(msg.sender).call{value: excess}("");
            require(refundSuccess, "Failed to refund excess");
        }
        
        // Record ticket purchase
        if (ticketCount[currentRoundId][msg.sender] == 0) {
            roundParticipants[currentRoundId].push(msg.sender);
        }
        
        ticketCount[currentRoundId][msg.sender] += _numberOfTickets;
        
        emit TicketsPurchased(currentRoundId, msg.sender, _numberOfTickets, feeAmount, vaultAmount);
    }
    
    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// VIEW FUNCTIONS ////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    function getPotDetails() external view returns (
        uint256 vaultBalance,    // Current prize pool in vault
        address vaultAddress,    // Vault wallet address
        address feeAddress,      // Fee wallet address
        uint256 ticketsSold      // Total tickets in current round
    ) {
        uint256 totalTickets;
        address[] storage participants = roundParticipants[currentRoundId];
        for (uint i = 0; i < participants.length; i++) {
            totalTickets += ticketCount[currentRoundId][participants[i]];
        }
        
        return (
            vaultWallet.balance,
            vaultWallet,
            feeWallet,
            totalTickets
        );
    }

    // Let a viewer check if they have bought tickets
    function viewTickets() external view returns (
        address playerAddress,
        uint256 playerTickets  // Total tickets in current round
    ) {
        playerTickets = ticketCount[currentRoundId][msg.sender];
        
        return (
            msg.sender,
            playerTickets
        );
    }

    function isDrawOpen() external view returns (
        bool isOpen,
        string memory status
    ) {
        Round storage currentRound = rounds[currentRoundId];
        
        // Check if a round has been initialized
        if (currentRound.startTime == 0) {
            return (false, "No draw has been started yet");
        }
        
        // Check if current round is finalized
        if (currentRound.finalized) {
            return (false, "Current draw has been completed");
        }
        
        uint256 currentTime = block.timestamp;
        
        // Check if we're within the valid time window
        if (currentTime < currentRound.startTime) {
            return (false, string.concat(
                "Draw will start at timestamp: ",
                Strings.toString(currentRound.startTime)
            ));
        }
        
        if (currentTime > currentRound.endTime) {
            return (false, string.concat(
                "Draw ended at timestamp: ",
                Strings.toString(currentRound.endTime)
            ));
        }
        
        // If we reach here, the draw is open
        uint256 timeRemaining = currentRound.endTime - currentTime;
        return (true, string.concat(
            "Draw is open. Time remaining (in seconds): ",
            Strings.toString(timeRemaining)
        ));
    }

}