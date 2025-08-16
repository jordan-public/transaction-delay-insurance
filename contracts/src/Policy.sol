// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Policy
 * @notice Insurance policy contract for transaction delay compensation
 * @dev Handles insurance purchases, claims, and payouts for delayed transactions
 */
contract Policy is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // Policy configuration
    struct PolicyConfig {
        uint256 delayThreshold; // Number of blocks considered as delay
        uint256 premiumPercentage; // Percentage of pool paid as premium (basis points)
        uint256 protocolFeePercentage; // Percentage taken as protocol fee (basis points)
        uint256 payoutPerIncident; // Fixed payout amount per incident (wei)
        bool active; // Whether policy is active
    }

    // User insurance data
    struct UserInsurance {
        uint256 ethDeposited; // Total ETH deposited by user
        uint256 incidentsRemaining; // Number of incidents still covered
        uint256 lastClaimBlock; // Last block when claim was made
    }

    // Claim proof structure
    struct ClaimProof {
        bytes32 txHash;
        uint256 broadcastBlock;
        uint256 confirmationBlock;
        bytes rpcSignature;
    }

    // Events
    event PolicyConfigured(
        uint256 delayThreshold,
        uint256 premiumPercentage,
        uint256 protocolFeePercentage,
        uint256 payoutPerIncident
    );
    event SharePurchased(address indexed user, uint256 ethAmount, uint256 incidentsCovered);
    event ClaimSubmitted(address indexed user, bytes32 indexed txHash, uint256 delay);
    event ClaimApproved(address indexed user, bytes32 indexed txHash, uint256 payout);
    event ClaimRejected(address indexed user, bytes32 indexed txHash, string reason);

    // State variables
    PolicyConfig public policyConfig;
    address public rpcProxyAddress;
    address public policyFactory; // Factory that created this policy
    uint256 public totalPool;
    uint256 public totalProtocolFees;
    
    mapping(address => UserInsurance) public userInsurance;
    mapping(bytes32 => bool) public processedClaims;

    // Constants
    uint256 public constant BASIS_POINTS = 10000;

    constructor(
        address _owner,
        address _rpcProxyAddress,
        uint256 _delayThreshold,
        uint256 _premiumPercentage,
        uint256 _protocolFeePercentage,
        uint256 _payoutPerIncident
    ) Ownable(_owner) {
        rpcProxyAddress = _rpcProxyAddress;
        policyFactory = msg.sender; // Store the factory address
        _configurePolicyParams(
            _delayThreshold,
            _premiumPercentage,
            _protocolFeePercentage,
            _payoutPerIncident
        );
    }

    /**
     * @notice Configure policy parameters (owner only)
     */
    function configurePolicyParams(
        uint256 _delayThreshold,
        uint256 _premiumPercentage,
        uint256 _protocolFeePercentage,
        uint256 _payoutPerIncident
    ) external onlyOwner {
        _configurePolicyParams(
            _delayThreshold,
            _premiumPercentage,
            _protocolFeePercentage,
            _payoutPerIncident
        );
    }

    function _configurePolicyParams(
        uint256 _delayThreshold,
        uint256 _premiumPercentage,
        uint256 _protocolFeePercentage,
        uint256 _payoutPerIncident
    ) internal {
        require(_premiumPercentage <= BASIS_POINTS, "Premium percentage too high");
        require(_protocolFeePercentage <= BASIS_POINTS, "Protocol fee percentage too high");
        require(_delayThreshold > 0, "Delay threshold must be positive");
        require(_payoutPerIncident > 0, "Payout per incident must be positive");

        policyConfig = PolicyConfig({
            delayThreshold: _delayThreshold,
            premiumPercentage: _premiumPercentage,
            protocolFeePercentage: _protocolFeePercentage,
            payoutPerIncident: _payoutPerIncident,
            active: true
        });

        emit PolicyConfigured(
            _delayThreshold,
            _premiumPercentage,
            _protocolFeePercentage,
            _payoutPerIncident
        );
    }

    /**
     * @notice Get quote for insurance purchase
     * @param ethAmount Amount of ETH to deposit
     * @return premium Premium amount to pay
     * @return incidentsCovered Number of incidents that will be covered
     */
    function getShareQuote(uint256 ethAmount) external view returns (uint256 premium, uint256 incidentsCovered) {
        require(policyConfig.active, "Policy not active");
        require(ethAmount > 0, "ETH amount must be positive");

        // Calculate premium as percentage of current pool
        premium = (totalPool * policyConfig.premiumPercentage) / BASIS_POINTS;
        
        // Calculate incidents covered based on ETH amount and payout per incident
        incidentsCovered = ethAmount / policyConfig.payoutPerIncident;
        
        return (premium, incidentsCovered);
    }

    /**
     * @notice Purchase insurance share
     */
    function purchaseShare() external payable nonReentrant {
        require(policyConfig.active, "Policy not active");
        require(msg.value > 0, "Must send ETH");

        (uint256 premium, uint256 incidentsCovered) = this.getShareQuote(msg.value);
        require(incidentsCovered > 0, "ETH amount too small for coverage");

        // Calculate protocol fee
        uint256 protocolFee = (msg.value * policyConfig.protocolFeePercentage) / BASIS_POINTS;
        uint256 toPool = msg.value - protocolFee;

        // Update state
        userInsurance[msg.sender].ethDeposited += msg.value;
        userInsurance[msg.sender].incidentsRemaining += incidentsCovered;
        totalPool += toPool;
        totalProtocolFees += protocolFee;

        emit SharePurchased(msg.sender, msg.value, incidentsCovered);
    }

    /**
     * @notice Submit insurance claim
     * @param proof Claim proof containing transaction data and RPC signature
     */
    function submitClaim(ClaimProof calldata proof) external nonReentrant {
        require(policyConfig.active, "Policy not active");
        require(!processedClaims[proof.txHash], "Claim already processed");
        require(userInsurance[msg.sender].incidentsRemaining > 0, "No incidents remaining");

        // Verify the delay
        uint256 delay = proof.confirmationBlock - proof.broadcastBlock;
        require(delay > policyConfig.delayThreshold, "Delay not sufficient for claim");

        // Verify RPC proxy signature
        bytes32 messageHash = keccak256(abi.encodePacked(
            proof.txHash,
            proof.broadcastBlock,
            proof.confirmationBlock
        )).toEthSignedMessageHash();

        address recoveredSigner = messageHash.recover(proof.rpcSignature);
        require(recoveredSigner == rpcProxyAddress, "Invalid RPC signature");

        // Mark claim as processed
        processedClaims[proof.txHash] = true;

        emit ClaimSubmitted(msg.sender, proof.txHash, delay);

        // Process payout
        uint256 payout = policyConfig.payoutPerIncident;
        
        if (totalPool >= payout) {
            // Update state
            userInsurance[msg.sender].incidentsRemaining -= 1;
            userInsurance[msg.sender].lastClaimBlock = block.number;
            totalPool -= payout;

            // Transfer payout
            (bool success, ) = payable(msg.sender).call{value: payout}("");
            require(success, "Payout transfer failed");

            emit ClaimApproved(msg.sender, proof.txHash, payout);
        } else {
            emit ClaimRejected(msg.sender, proof.txHash, "Insufficient pool funds");
            revert("Insufficient pool funds");
        }
    }

    /**
     * @notice Withdraw protocol fees (owner only)
     */
    function withdrawProtocolFees() external onlyOwner nonReentrant {
        uint256 amount = totalProtocolFees;
        require(amount > 0, "No fees to withdraw");

        totalProtocolFees = 0;
        
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Fee withdrawal failed");
    }

    /**
     * @notice Set RPC proxy address (owner only)
     */
    function setRpcProxyAddress(address _rpcProxyAddress) external onlyOwner {
        require(_rpcProxyAddress != address(0), "Invalid RPC proxy address");
        rpcProxyAddress = _rpcProxyAddress;
    }

    /**
     * @notice Toggle policy active status (owner or factory only)
     */
    function togglePolicyStatus() external {
        require(msg.sender == owner() || msg.sender == policyFactory, "Unauthorized");
        policyConfig.active = !policyConfig.active;
    }

    /**
     * @notice Get user insurance details
     */
    function getUserInsurance(address user) external view returns (UserInsurance memory) {
        return userInsurance[user];
    }

    /**
     * @notice Get policy details
     */
    function getPolicyDetails() external view returns (PolicyConfig memory) {
        return policyConfig;
    }

    /**
     * @notice Get contract stats
     */
    function getContractStats() external view returns (
        uint256 _totalPool,
        uint256 _totalProtocolFees,
        bool _active
    ) {
        return (totalPool, totalProtocolFees, policyConfig.active);
    }
}
