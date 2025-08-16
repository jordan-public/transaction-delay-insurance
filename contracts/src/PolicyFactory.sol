// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Policy.sol";

/**
 * @title PolicyFactory
 * @notice Factory contract for creating and managing insurance policies
 * @dev Allows admins to create multiple policy contracts with different parameters
 */
contract PolicyFactory is Ownable {
    
    // Policy metadata
    struct PolicyInfo {
        address policyAddress;
        string name;
        string description;
        uint256 createdAt;
        bool active;
    }

    // Events
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed policyAddress,
        string name,
        address rpcProxyAddress
    );
    event PolicyStatusUpdated(uint256 indexed policyId, bool active);
    event DefaultRpcProxyUpdated(address newRpcProxy);

    // State variables
    uint256 public nextPolicyId;
    address public defaultRpcProxyAddress;
    
    mapping(uint256 => PolicyInfo) public policies;
    mapping(address => uint256[]) public userPolicies; // Track which policies a user has purchased
    
    uint256[] public allPolicyIds;

    constructor(address _owner, address _defaultRpcProxyAddress) Ownable(_owner) {
        defaultRpcProxyAddress = _defaultRpcProxyAddress;
    }

    /**
     * @notice Create a new insurance policy
     * @param name Human-readable name for the policy
     * @param description Description of the policy
     * @param rpcProxyAddress RPC proxy address for this policy (use address(0) for default)
     * @param delayThreshold Number of blocks considered as delay
     * @param premiumPercentage Percentage of pool paid as premium (basis points)
     * @param protocolFeePercentage Percentage taken as protocol fee (basis points)
     * @param payoutPerIncident Fixed payout amount per incident (wei)
     * @return policyId The ID of the newly created policy
     */
    function createPolicy(
        string memory name,
        string memory description,
        address rpcProxyAddress,
        uint256 delayThreshold,
        uint256 premiumPercentage,
        uint256 protocolFeePercentage,
        uint256 payoutPerIncident
    ) external onlyOwner returns (uint256 policyId) {
        require(bytes(name).length > 0, "Policy name required");
        require(delayThreshold > 0, "Delay threshold must be positive");
        require(payoutPerIncident > 0, "Payout per incident must be positive");

        // Use default RPC proxy if not specified
        address proxyAddress = rpcProxyAddress == address(0) ? defaultRpcProxyAddress : rpcProxyAddress;
        require(proxyAddress != address(0), "RPC proxy address required");

        policyId = nextPolicyId++;

        // Deploy new Policy contract
        Policy newPolicy = new Policy(
            owner(),
            proxyAddress,
            delayThreshold,
            premiumPercentage,
            protocolFeePercentage,
            payoutPerIncident
        );

        // Store policy info
        policies[policyId] = PolicyInfo({
            policyAddress: address(newPolicy),
            name: name,
            description: description,
            createdAt: block.timestamp,
            active: true
        });

        allPolicyIds.push(policyId);

        emit PolicyCreated(policyId, address(newPolicy), name, proxyAddress);

        return policyId;
    }

    /**
     * @notice Update policy status (active/inactive)
     * @param policyId ID of the policy to update
     * @param active New active status
     */
    function updatePolicyStatus(uint256 policyId, bool active) external onlyOwner {
        require(policies[policyId].policyAddress != address(0), "Policy does not exist");
        
        policies[policyId].active = active;
        
        // Also toggle the policy contract's status
        // Note: The policy contract should have this factory as owner or allow this call
        Policy(payable(policies[policyId].policyAddress)).togglePolicyStatus();
        
        emit PolicyStatusUpdated(policyId, active);
    }

    /**
     * @notice Set default RPC proxy address
     * @param newRpcProxy New default RPC proxy address
     */
    function setDefaultRpcProxy(address newRpcProxy) external onlyOwner {
        require(newRpcProxy != address(0), "Invalid RPC proxy address");
        defaultRpcProxyAddress = newRpcProxy;
        emit DefaultRpcProxyUpdated(newRpcProxy);
    }

    /**
     * @notice Get all policy IDs
     * @return Array of all policy IDs
     */
    function getAllPolicyIds() external view returns (uint256[] memory) {
        return allPolicyIds;
    }

    /**
     * @notice Get all active policies
     * @return activePolicyIds Array of active policy IDs
     * @return policyInfos Array of corresponding policy information
     */
    function getActivePolicies() external view returns (
        uint256[] memory activePolicyIds,
        PolicyInfo[] memory policyInfos
    ) {
        // First, count active policies
        uint256 activeCount = 0;
        for (uint256 i = 0; i < allPolicyIds.length; i++) {
            if (policies[allPolicyIds[i]].active) {
                activeCount++;
            }
        }

        // Create arrays for active policies
        activePolicyIds = new uint256[](activeCount);
        policyInfos = new PolicyInfo[](activeCount);

        // Populate arrays
        uint256 index = 0;
        for (uint256 i = 0; i < allPolicyIds.length; i++) {
            uint256 policyId = allPolicyIds[i];
            if (policies[policyId].active) {
                activePolicyIds[index] = policyId;
                policyInfos[index] = policies[policyId];
                index++;
            }
        }

        return (activePolicyIds, policyInfos);
    }

    /**
     * @notice Get policy information by ID
     * @param policyId ID of the policy
     * @return Policy information
     */
    function getPolicyInfo(uint256 policyId) external view returns (PolicyInfo memory) {
        require(policies[policyId].policyAddress != address(0), "Policy does not exist");
        return policies[policyId];
    }

    /**
     * @notice Get policy contract address by ID
     * @param policyId ID of the policy
     * @return Address of the policy contract
     */
    function getPolicyAddress(uint256 policyId) external view returns (address) {
        require(policies[policyId].policyAddress != address(0), "Policy does not exist");
        return policies[policyId].policyAddress;
    }

    /**
     * @notice Get policy details including contract configuration
     * @param policyId ID of the policy
     * @return policyInfo Basic policy information
     * @return config Policy configuration from the contract
     * @return totalPool Total pool amount
     * @return totalProtocolFees Total protocol fees
     * @return contractActive Whether the contract is active
     */
    function getPolicyDetails(uint256 policyId) external view returns (
        PolicyInfo memory policyInfo,
        Policy.PolicyConfig memory config,
        uint256 totalPool,
        uint256 totalProtocolFees,
        bool contractActive
    ) {
        require(policies[policyId].policyAddress != address(0), "Policy does not exist");
        
        policyInfo = policies[policyId];
        Policy policyContract = Policy(payable(policyInfo.policyAddress));
        
        config = policyContract.getPolicyDetails();
        (totalPool, totalProtocolFees, contractActive) = policyContract.getContractStats();
        
        return (policyInfo, config, totalPool, totalProtocolFees, contractActive);
    }

    /**
     * @notice Check if a policy exists
     * @param policyId ID of the policy to check
     * @return exists Whether the policy exists
     */
    function policyExists(uint256 policyId) external view returns (bool exists) {
        return policies[policyId].policyAddress != address(0);
    }

    /**
     * @notice Get total number of policies created
     * @return Total number of policies
     */
    function getTotalPolicies() external view returns (uint256) {
        return allPolicyIds.length;
    }

    /**
     * @notice Track user policy purchase (called by policy contracts)
     * @dev This would need to be implemented if we want to track user interactions across policies
     */
    function recordUserPolicyPurchase(address user, uint256 policyId) external {
        // Verify caller is a valid policy contract
        require(policies[policyId].policyAddress == msg.sender, "Unauthorized caller");
        
        // Check if user already has this policy recorded
        uint256[] storage userPolicyList = userPolicies[user];
        for (uint256 i = 0; i < userPolicyList.length; i++) {
            if (userPolicyList[i] == policyId) {
                return; // Already recorded
            }
        }
        
        // Add policy to user's list
        userPolicyList.push(policyId);
    }

    /**
     * @notice Get policies purchased by a user
     * @param user Address of the user
     * @return Array of policy IDs purchased by the user
     */
    function getUserPolicies(address user) external view returns (uint256[] memory) {
        return userPolicies[user];
    }
}
