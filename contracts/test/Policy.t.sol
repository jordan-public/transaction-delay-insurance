// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/Policy.sol";

contract PolicyTest is Test {
    Policy public policy;
    address public owner;
    address public rpcProxy;
    address public user1;
    address public user2;

    // Policy configuration constants
    uint256 constant DELAY_THRESHOLD = 10;
    uint256 constant PREMIUM_PERCENTAGE = 100; // 1%
    uint256 constant PROTOCOL_FEE_PERCENTAGE = 1000; // 10%
    uint256 constant PAYOUT_PER_INCIDENT = 0.1 ether;

    uint256 constant BASIS_POINTS = 10000;

    event SharePurchased(address indexed user, uint256 ethAmount, uint256 incidentsCovered);
    event ClaimApproved(address indexed user, bytes32 indexed txHash, uint256 payout);
    event ClaimRejected(address indexed user, bytes32 indexed txHash, string reason);

    function setUp() public {
        owner = makeAddr("owner");
        rpcProxy = makeAddr("rpcProxy");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        vm.prank(owner);
        policy = new Policy(
            owner,
            rpcProxy,
            DELAY_THRESHOLD,
            PREMIUM_PERCENTAGE,
            PROTOCOL_FEE_PERCENTAGE,
            PAYOUT_PER_INCIDENT
        );

        // Fund test accounts
        vm.deal(user1, 10 ether);
        vm.deal(user2, 10 ether);
        // No initial pool funding - starts at 0
    }

    function testConstructor() public view {
        Policy.PolicyConfig memory config = policy.getPolicyDetails();
        
        assertEq(config.delayThreshold, DELAY_THRESHOLD);
        assertEq(config.premiumPercentage, PREMIUM_PERCENTAGE);
        assertEq(config.protocolFeePercentage, PROTOCOL_FEE_PERCENTAGE);
        assertEq(config.payoutPerIncident, PAYOUT_PER_INCIDENT);
        assertTrue(config.active);
        
        assertEq(policy.owner(), owner);
        assertEq(policy.rpcProxyAddress(), rpcProxy);
    }

    function testGetShareQuote() public view {
        uint256 ethAmount = 1 ether;
        (uint256 premium, uint256 incidentsCovered) = policy.getShareQuote(ethAmount);
        
        // Premium should be 1% of current pool (starts at 0)
        uint256 expectedPremium = (0 * PREMIUM_PERCENTAGE) / BASIS_POINTS;
        assertEq(premium, expectedPremium);
        
        // Incidents covered should be ethAmount / payoutPerIncident
        uint256 expectedIncidents = ethAmount / PAYOUT_PER_INCIDENT;
        assertEq(incidentsCovered, expectedIncidents);
    }

    function testPurchaseShare() public {
        uint256 ethAmount = 1 ether;
        (uint256 premium, uint256 expectedIncidents) = policy.getShareQuote(ethAmount);

        vm.prank(user1);
        vm.expectEmit(true, false, false, true);
        emit SharePurchased(user1, ethAmount, expectedIncidents);
        
        policy.purchaseShare{value: ethAmount}();

        // Check user insurance
        Policy.UserInsurance memory userInsurance = policy.getUserInsurance(user1);
        assertEq(userInsurance.ethDeposited, ethAmount);
        assertEq(userInsurance.incidentsRemaining, expectedIncidents);

        // Check contract state
        (uint256 totalPool, uint256 totalProtocolFees,) = policy.getContractStats();
        uint256 expectedProtocolFee = (ethAmount * PROTOCOL_FEE_PERCENTAGE) / BASIS_POINTS;
        uint256 expectedPoolIncrease = ethAmount - expectedProtocolFee;
        
        assertEq(totalPool, expectedPoolIncrease); // Started at 0
        assertEq(totalProtocolFees, expectedProtocolFee);
    }

    function testPurchaseShareFailsWithZeroValue() public {
        vm.prank(user1);
        vm.expectRevert("Must send ETH");
        policy.purchaseShare{value: 0}();
    }

    function testPurchaseShareFailsWhenInactive() public {
        vm.prank(owner);
        policy.togglePolicyStatus();

        vm.prank(user1);
        vm.expectRevert("Policy not active");
        policy.purchaseShare{value: 1 ether}();
    }

    function testSubmitValidClaim() public {
        // First purchase insurance
        vm.prank(user1);
        policy.purchaseShare{value: 1 ether}();

        // Create claim proof
        bytes32 txHash = keccak256("test_transaction");
        uint256 broadcastBlock = 100;
        uint256 confirmationBlock = broadcastBlock + DELAY_THRESHOLD + 5; // Delay > threshold

        // Create signature (simulating RPC proxy signature)
        bytes32 messageHash = keccak256(abi.encodePacked(txHash, broadcastBlock, confirmationBlock));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            uint256(keccak256(abi.encodePacked("rpcProxy"))), // Use deterministic private key for rpcProxy
            ethSignedMessageHash
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        // Update rpcProxy address to match the signer
        address actualRpcProxy = vm.addr(uint256(keccak256(abi.encodePacked("rpcProxy"))));
        vm.prank(owner);
        policy.setRpcProxyAddress(actualRpcProxy);

        Policy.ClaimProof memory proof = Policy.ClaimProof({
            txHash: txHash,
            broadcastBlock: broadcastBlock,
            confirmationBlock: confirmationBlock,
            rpcSignature: signature
        });

        uint256 initialBalance = user1.balance;
        
        vm.prank(user1);
        vm.expectEmit(true, true, false, true);
        emit ClaimApproved(user1, txHash, PAYOUT_PER_INCIDENT);
        
        policy.submitClaim(proof);

        // Check payout was received
        assertEq(user1.balance, initialBalance + PAYOUT_PER_INCIDENT);

        // Check user insurance was updated
        Policy.UserInsurance memory userInsurance = policy.getUserInsurance(user1);
        assertEq(userInsurance.incidentsRemaining, 9); // Started with 10, used 1

        // Check claim was marked as processed
        assertTrue(policy.processedClaims(txHash));
    }

    function testSubmitClaimFailsInsufficientDelay() public {
        // First purchase insurance
        vm.prank(user1);
        policy.purchaseShare{value: 1 ether}();

        // Create claim proof with insufficient delay
        bytes32 txHash = keccak256("test_transaction");
        uint256 broadcastBlock = 100;
        uint256 confirmationBlock = broadcastBlock + DELAY_THRESHOLD - 1; // Delay <= threshold

        bytes32 messageHash = keccak256(abi.encodePacked(txHash, broadcastBlock, confirmationBlock));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            uint256(keccak256(abi.encodePacked("rpcProxy"))),
            ethSignedMessageHash
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        address actualRpcProxy = vm.addr(uint256(keccak256(abi.encodePacked("rpcProxy"))));
        vm.prank(owner);
        policy.setRpcProxyAddress(actualRpcProxy);

        Policy.ClaimProof memory proof = Policy.ClaimProof({
            txHash: txHash,
            broadcastBlock: broadcastBlock,
            confirmationBlock: confirmationBlock,
            rpcSignature: signature
        });

        vm.prank(user1);
        vm.expectRevert("Delay not sufficient for claim");
        policy.submitClaim(proof);
    }

    function testSubmitClaimFailsInvalidSignature() public {
        // First purchase insurance
        vm.prank(user1);
        policy.purchaseShare{value: 1 ether}();

        // Create claim proof with invalid signature
        bytes32 txHash = keccak256("test_transaction");
        uint256 broadcastBlock = 100;
        uint256 confirmationBlock = broadcastBlock + DELAY_THRESHOLD + 5;

        bytes memory invalidSignature = abi.encodePacked(bytes32(0), bytes32(0), uint8(0));

        Policy.ClaimProof memory proof = Policy.ClaimProof({
            txHash: txHash,
            broadcastBlock: broadcastBlock,
            confirmationBlock: confirmationBlock,
            rpcSignature: invalidSignature
        });

        vm.prank(user1);
        vm.expectRevert(); // Just expect any revert, as the ECDSA library may throw different errors
        policy.submitClaim(proof);
    }

    function testSubmitClaimFailsNoIncidentsRemaining() public {
        // Create user with no insurance
        vm.prank(user2);
        vm.expectRevert("No incidents remaining");
        
        Policy.ClaimProof memory proof = Policy.ClaimProof({
            txHash: bytes32(0),
            broadcastBlock: 0,
            confirmationBlock: 0,
            rpcSignature: ""
        });
        
        policy.submitClaim(proof);
    }

    function testSubmitClaimFailsDuplicateClaim() public {
        // First purchase insurance
        vm.prank(user1);
        policy.purchaseShare{value: 1 ether}();

        // Create and submit valid claim
        bytes32 txHash = keccak256("test_transaction");
        uint256 broadcastBlock = 100;
        uint256 confirmationBlock = broadcastBlock + DELAY_THRESHOLD + 5;

        bytes32 messageHash = keccak256(abi.encodePacked(txHash, broadcastBlock, confirmationBlock));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(
            uint256(keccak256(abi.encodePacked("rpcProxy"))),
            ethSignedMessageHash
        );
        bytes memory signature = abi.encodePacked(r, s, v);

        address actualRpcProxy = vm.addr(uint256(keccak256(abi.encodePacked("rpcProxy"))));
        vm.prank(owner);
        policy.setRpcProxyAddress(actualRpcProxy);

        Policy.ClaimProof memory proof = Policy.ClaimProof({
            txHash: txHash,
            broadcastBlock: broadcastBlock,
            confirmationBlock: confirmationBlock,
            rpcSignature: signature
        });

        vm.prank(user1);
        policy.submitClaim(proof);

        // Try to submit same claim again
        vm.prank(user1);
        vm.expectRevert("Claim already processed");
        policy.submitClaim(proof);
    }

    function testWithdrawProtocolFees() public {
        // Generate some protocol fees by having user purchase insurance
        vm.prank(user1);
        policy.purchaseShare{value: 1 ether}();

        uint256 expectedFees = (1 ether * PROTOCOL_FEE_PERCENTAGE) / BASIS_POINTS;
        
        uint256 ownerBalanceBefore = owner.balance;
        
        vm.prank(owner);
        policy.withdrawProtocolFees();

        assertEq(owner.balance, ownerBalanceBefore + expectedFees);
        
        (, uint256 totalProtocolFees,) = policy.getContractStats();
        assertEq(totalProtocolFees, 0);
    }

    function testWithdrawProtocolFeesFailsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        policy.withdrawProtocolFees();
    }

    function testSetRpcProxyAddress() public {
        address newRpcProxy = makeAddr("newRpcProxy");
        
        vm.prank(owner);
        policy.setRpcProxyAddress(newRpcProxy);
        
        assertEq(policy.rpcProxyAddress(), newRpcProxy);
    }

    function testSetRpcProxyAddressFailsNotOwner() public {
        address newRpcProxy = makeAddr("newRpcProxy");
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        policy.setRpcProxyAddress(newRpcProxy);
    }

    function testTogglePolicyStatus() public {
        assertTrue(policy.getPolicyDetails().active);
        
        vm.prank(owner);
        policy.togglePolicyStatus();
        
        assertFalse(policy.getPolicyDetails().active);
        
        vm.prank(owner);
        policy.togglePolicyStatus();
        
        assertTrue(policy.getPolicyDetails().active);
    }

    function testConfigurePolicyParams() public {
        uint256 newDelayThreshold = 20;
        uint256 newPremiumPercentage = 200;
        uint256 newProtocolFeePercentage = 500;
        uint256 newPayoutPerIncident = 0.2 ether;

        vm.prank(owner);
        policy.configurePolicyParams(
            newDelayThreshold,
            newPremiumPercentage,
            newProtocolFeePercentage,
            newPayoutPerIncident
        );

        Policy.PolicyConfig memory config = policy.getPolicyDetails();
        assertEq(config.delayThreshold, newDelayThreshold);
        assertEq(config.premiumPercentage, newPremiumPercentage);
        assertEq(config.protocolFeePercentage, newProtocolFeePercentage);
        assertEq(config.payoutPerIncident, newPayoutPerIncident);
    }
}
