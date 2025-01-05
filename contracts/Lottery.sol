// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/Strings.sol";



interface IVaultWallet {
    function getBalance() external view returns (uint256);
    function withdraw(address to, uint256 amount) external;
    function initialize(address _lotteryContract) external;
}

contract Lottery {

    ////////////////////////////////////////////////////////////////////////////
    ///////////////////////// VARIABLE DECLARATION /////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    address public owner;          // Owner of the lottery contract
    address public feeWallet;     // Wallet to receive fees
    uint256 public ticketPrice;   // cost of entry
    uint256 public ticketFee;     // Our fee

    IVaultWallet public vaultWallet;  // Vault wallet to hold prize pool
    uint256 public currentRoundId;    // Current round ID

    bool private locked;             // Reentrancy guard
    
    struct Round {
        uint256 startTime;           // Start time of the round
        uint256 endTime;             // End time of the round
        uint256 drawTime;            // Draw time of the round
        address winner;              // Winner of the round
        uint256 prize;               // Prize for the round - Only set when winner is drawn
        uint256 ticketsSold;         // Tickets sold for the round
        bool finalized;              // Whether the round is finalized
    }
    
    // Can probably remove this as we can get this from the rounds mapping
    struct Winners {
        uint256 roundId;
        address winner;
        uint256 prize;
    }

    mapping(uint256 => Round) public rounds;  // Mapping of round IDs to round details
    mapping(uint256 => Winners) public winners;  // Mapping of round IDs to winners
    mapping(uint256 => address[]) public roundParticipants;  // Mapping of round IDs to participants
    mapping(uint256 => mapping(address => uint256)) public ticketCount;  // Mapping of round IDs to ticket counts for each participant
    
    ////////////////////////////////////////////////////////////////////////////
    ////////////////////////////// EVENTS //////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    event FeeWalletUpdated(address indexed oldWallet, address indexed newWallet);  // Event for when the fee wallet is updated
    event VaultWalletUpdated(address indexed oldVault, address indexed newVault);  // Event for when the vault wallet is updated
    event TicketsPurchased(uint256 roundId, address indexed buyer, uint256 amount, uint256 fee, uint256 toVault);  // Event for when tickets are purchased
    event PrizeDistributed(uint256 roundId, address indexed winner, uint256 prize);  // Event for when the prize is distributed
    event FeeDistributed(uint256 roundId, address indexed feeWallet, uint256 amount);  // Event for when the fee is distributed
    event TicketPriceUpdated(uint256 oldPrice, uint256 newPrice, uint256 timestamp);
    

    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// MODIFIERS /////////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    
    // Only owner can call functions
    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }
    
    // Reentrancy guard
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
        vaultWallet = IVaultWallet(_vaultWallet);
        ticketPrice = _ticketPrice;
        ticketFee = (_ticketPrice * 5) / 100;
    }
    
    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// OWNER FUNCTIONS ///////////////////////////////
    ////////////////////////////////////////////////////////////////////////////

    // Set fee receiving  contract
    function setFeeWallet(address _newFeeWallet) external onlyOwner {
        require(_newFeeWallet != address(0), "Invalid fee wallet address");
        address oldWallet = feeWallet;
        feeWallet = _newFeeWallet;
        emit FeeWalletUpdated(oldWallet, _newFeeWallet);
    }
    
    // Set prize vault wallet
    function setVaultWallet(address _newVaultWallet) external onlyOwner {
        require(_newVaultWallet != address(0), "Invalid vault address");
        address oldVault = address(vaultWallet);  // Convert IVaultWallet to address
        vaultWallet = IVaultWallet(_newVaultWallet);  // Convert address to IVaultWallet
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
        uint256 startTime = block.timestamp;   // Current time
        uint256 endTime = startTime + 7 days;  // 7 days from now
        uint256 drawTime = endTime + 1 hours;  // 1 hour after end

        // Initialize new round
        currentRound.startTime = startTime;
        currentRound.endTime = endTime;
        currentRound.drawTime = drawTime;
        currentRound.winner = address(0);
        currentRound.prize = 0;
        currentRound.ticketsSold = 0;
        currentRound.finalized = false;
    }

    // Modified selectWinner to draw from vault
    function selectWinner() external onlyOwner nonReentrant returns (address winner, uint256 prize) {
        Round storage currentRound = rounds[currentRoundId];
        require(!currentRound.finalized, "Round already finalized");
        require(currentRound.ticketsSold > 0, "No tickets sold");
        
        // Select winner
        // TODO: Use a more secure random number generator
        uint256 winningTicket = uint256(
            keccak256(
                abi.encodePacked(
                    block.timestamp,
                    block.prevrandao,
                    blockhash(block.number - 1)
                )
            )
        ) % currentRound.ticketsSold;
        
        uint256 ticketSum;
        for (uint i = 0; i < roundParticipants[currentRoundId].length; i++) {
            ticketSum += ticketCount[currentRoundId][roundParticipants[currentRoundId][i]];
            if (ticketSum > winningTicket) {
                winner = roundParticipants[currentRoundId][i];
                break;
            }
        }
        
        currentRound.winner = winner;
        currentRound.finalized = true;
        
        prize = vaultWallet.getBalance();
        currentRound.prize = prize;

        // Add winner to winners array
        winners[currentRoundId].roundId = currentRoundId;
        winners[currentRoundId].winner = winner;
        winners[currentRoundId].prize = prize;
        
        currentRoundId += 1;
        
        // Transfer prize from vault to winner
        vaultWallet.withdraw(winner, prize);
        
        emit PrizeDistributed(currentRoundId - 1, winner, prize);
        return (winner, prize);
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
        
        // Forward vault amount to vault
        (bool vaultSuccess, ) = payable(address(vaultWallet)).call{value: vaultAmount}("");
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
        
        currentRound.ticketsSold += _numberOfTickets;
        
        emit TicketsPurchased(currentRoundId, msg.sender, _numberOfTickets, feeAmount, vaultAmount);
        
    }
    
    ////////////////////////////////////////////////////////////////////////////
    //////////////////////////// VIEW FUNCTIONS ////////////////////////////////
    ////////////////////////////////////////////////////////////////////////////
    
    function getPotDetails() external view returns (
        uint256 currentBalance,      // Real-time vault balance
        uint256 ticketsSold,        // Current ticket count
        uint256 startTime,          // Fixed start time
        uint256 endTime,            // Fixed end time
        uint256 drawTime,           // Fixed draw time
        uint256 timeRemaining,      // Calculated time remaining
        bool isFinalized,           // Round status
        address winner              // Winner (if drawn)
    ) {    
        Round storage currentRound = rounds[currentRoundId];
        
        uint256 _timeRemaining;
        if (block.timestamp < currentRound.endTime) {
            _timeRemaining = currentRound.endTime - block.timestamp;
        }
        
        return (
            vaultWallet.getBalance(),  // This gets current balance
            currentRound.ticketsSold,
            currentRound.startTime,
            currentRound.endTime,
            currentRound.drawTime,
            _timeRemaining,
            currentRound.finalized,
            currentRound.winner
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