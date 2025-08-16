// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PolicyFactory.sol";
import "../src/Policy.sol";

contract PolicyFactoryTest is Test {
    PolicyFactory public factory;
    address public owner;
    address public defaultRpcProxy;
    address public user1;

    event PolicyCreated(
        uint256 indexed policyId,
        address indexed policyAddress,
        string name,
        address rpcProxyAddress
    );
    event PolicyStatusUpdated(uint256 indexed policyId, bool active);
    event DefaultRpcProxyUpdated(address newRpcProxy);

    function setUp() public {
        owner = makeAddr("owner");
        defaultRpcProxy = makeAddr("defaultRpcProxy");
        user1 = makeAddr("user1");

        vm.prank(owner);
        factory = new PolicyFactory(owner, defaultRpcProxy);
    }

    function testConstructor() public view {
        assertEq(factory.owner(), owner);
        assertEq(factory.defaultRpcProxyAddress(), defaultRpcProxy);
        assertEq(factory.nextPolicyId(), 0);
        assertEq(factory.getTotalPolicies(), 0);
    }

    function testCreatePolicy() public {
        string memory name = "Basic Delay Insurance";
        string memory description = "Basic policy for transaction delay protection";
        uint256 delayThreshold = 10;
        uint256 premiumPercentage = 100; // 1%
        uint256 protocolFeePercentage = 1000; // 10%
        uint256 payoutPerIncident = 0.1 ether;

        vm.prank(owner);
        // Don't check the exact event since we can't predict the policy address
        uint256 policyId = factory.createPolicy(
            name,
            description,
            address(0), // Use default RPC proxy
            delayThreshold,
            premiumPercentage,
            protocolFeePercentage,
            payoutPerIncident
        );

        assertEq(policyId, 0);
        assertEq(factory.nextPolicyId(), 1);
        assertEq(factory.getTotalPolicies(), 1);

        // Check policy info
        PolicyFactory.PolicyInfo memory info = factory.getPolicyInfo(policyId);
        assertEq(info.name, name);
        assertEq(info.description, description);
        assertTrue(info.active);
        assertTrue(info.policyAddress != address(0));

        // Check policy contract was deployed correctly
        Policy policyContract = Policy(payable(info.policyAddress));
        assertEq(policyContract.owner(), owner);
        assertEq(policyContract.rpcProxyAddress(), defaultRpcProxy);
        
        Policy.PolicyConfig memory config = policyContract.getPolicyDetails();
        assertEq(config.delayThreshold, delayThreshold);
        assertEq(config.premiumPercentage, premiumPercentage);
        assertEq(config.protocolFeePercentage, protocolFeePercentage);
        assertEq(config.payoutPerIncident, payoutPerIncident);
        assertTrue(config.active);
    }

    function testCreatePolicyWithCustomRpcProxy() public {
        address customRpcProxy = makeAddr("customRpcProxy");
        
        vm.prank(owner);
        uint256 policyId = factory.createPolicy(
            "Custom RPC Policy",
            "Policy with custom RPC proxy",
            customRpcProxy,
            15,
            150,
            800,
            0.15 ether
        );

        PolicyFactory.PolicyInfo memory info = factory.getPolicyInfo(policyId);
        Policy policyContract = Policy(payable(info.policyAddress));
        assertEq(policyContract.rpcProxyAddress(), customRpcProxy);
    }

    function testCreatePolicyFailsNotOwner() public {
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        
        factory.createPolicy(
            "Unauthorized Policy",
            "This should fail",
            address(0),
            10,
            100,
            1000,
            0.1 ether
        );
    }

    function testCreatePolicyFailsEmptyName() public {
        vm.prank(owner);
        vm.expectRevert("Policy name required");
        
        factory.createPolicy(
            "",
            "Policy with empty name",
            address(0),
            10,
            100,
            1000,
            0.1 ether
        );
    }

    function testCreatePolicyFailsZeroDelayThreshold() public {
        vm.prank(owner);
        vm.expectRevert("Delay threshold must be positive");
        
        factory.createPolicy(
            "Invalid Policy",
            "Policy with zero delay threshold",
            address(0),
            0,
            100,
            1000,
            0.1 ether
        );
    }

    function testCreatePolicyFailsZeroPayout() public {
        vm.prank(owner);
        vm.expectRevert("Payout per incident must be positive");
        
        factory.createPolicy(
            "Invalid Policy",
            "Policy with zero payout",
            address(0),
            10,
            100,
            1000,
            0
        );
    }

    function testUpdatePolicyStatus() public {
        // Create a policy first
        vm.prank(owner);
        uint256 policyId = factory.createPolicy(
            "Test Policy",
            "Test Description",
            address(0),
            10,
            100,
            1000,
            0.1 ether
        );

        // Check initial status
        PolicyFactory.PolicyInfo memory info = factory.getPolicyInfo(policyId);
        assertTrue(info.active);

        // Update status to inactive
        vm.prank(owner);
        vm.expectEmit(true, false, false, true);
        emit PolicyStatusUpdated(policyId, false);
        
        factory.updatePolicyStatus(policyId, false);

        // Check status was updated
        info = factory.getPolicyInfo(policyId);
        assertFalse(info.active);

        // Check policy contract status was also updated
        Policy policyContract = Policy(payable(info.policyAddress));
        assertFalse(policyContract.getPolicyDetails().active);
    }

    function testUpdatePolicyStatusFailsNotOwner() public {
        vm.prank(owner);
        uint256 policyId = factory.createPolicy(
            "Test Policy",
            "Test Description",
            address(0),
            10,
            100,
            1000,
            0.1 ether
        );

        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        factory.updatePolicyStatus(policyId, false);
    }

    function testUpdatePolicyStatusFailsNonexistentPolicy() public {
        vm.prank(owner);
        vm.expectRevert("Policy does not exist");
        factory.updatePolicyStatus(999, false);
    }

    function testSetDefaultRpcProxy() public {
        address newRpcProxy = makeAddr("newRpcProxy");
        
        vm.prank(owner);
        vm.expectEmit(false, false, false, true);
        emit DefaultRpcProxyUpdated(newRpcProxy);
        
        factory.setDefaultRpcProxy(newRpcProxy);
        
        assertEq(factory.defaultRpcProxyAddress(), newRpcProxy);
    }

    function testSetDefaultRpcProxyFailsNotOwner() public {
        address newRpcProxy = makeAddr("newRpcProxy");
        
        vm.prank(user1);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, user1));
        factory.setDefaultRpcProxy(newRpcProxy);
    }

    function testSetDefaultRpcProxyFailsZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Invalid RPC proxy address");
        factory.setDefaultRpcProxy(address(0));
    }

    function testGetAllPolicyIds() public {
        // Initially empty
        uint256[] memory ids = factory.getAllPolicyIds();
        assertEq(ids.length, 0);

        // Create some policies
        vm.startPrank(owner);
        factory.createPolicy("Policy 1", "Description 1", address(0), 10, 100, 1000, 0.1 ether);
        factory.createPolicy("Policy 2", "Description 2", address(0), 15, 150, 800, 0.15 ether);
        factory.createPolicy("Policy 3", "Description 3", address(0), 20, 200, 600, 0.2 ether);
        vm.stopPrank();

        ids = factory.getAllPolicyIds();
        assertEq(ids.length, 3);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
        assertEq(ids[2], 2);
    }

    function testGetActivePolicies() public {
        // Create some policies
        vm.startPrank(owner);
        uint256 policy1 = factory.createPolicy("Policy 1", "Description 1", address(0), 10, 100, 1000, 0.1 ether);
        uint256 policy2 = factory.createPolicy("Policy 2", "Description 2", address(0), 15, 150, 800, 0.15 ether);
        uint256 policy3 = factory.createPolicy("Policy 3", "Description 3", address(0), 20, 200, 600, 0.2 ether);
        
        // Deactivate policy 2
        factory.updatePolicyStatus(policy2, false);
        vm.stopPrank();

        (uint256[] memory activePolicyIds, PolicyFactory.PolicyInfo[] memory policyInfos) = factory.getActivePolicies();
        
        assertEq(activePolicyIds.length, 2);
        assertEq(policyInfos.length, 2);
        
        // Should contain policy 1 and 3, but not 2
        bool hasPolicy1 = false;
        bool hasPolicy3 = false;
        bool hasPolicy2 = false;
        
        for (uint256 i = 0; i < activePolicyIds.length; i++) {
            if (activePolicyIds[i] == policy1) hasPolicy1 = true;
            if (activePolicyIds[i] == policy3) hasPolicy3 = true;
            if (activePolicyIds[i] == policy2) hasPolicy2 = true;
        }
        
        assertTrue(hasPolicy1);
        assertTrue(hasPolicy3);
        assertFalse(hasPolicy2);
    }

    function testGetPolicyDetails() public {
        vm.prank(owner);
        uint256 policyId = factory.createPolicy(
            "Detailed Policy",
            "Policy for testing details",
            address(0),
            25,
            250,
            500,
            0.25 ether
        );

        (
            PolicyFactory.PolicyInfo memory policyInfo,
            Policy.PolicyConfig memory config,
            uint256 totalPool,
            uint256 totalProtocolFees,
            bool contractActive
        ) = factory.getPolicyDetails(policyId);

        assertEq(policyInfo.name, "Detailed Policy");
        assertEq(policyInfo.description, "Policy for testing details");
        assertTrue(policyInfo.active);

        assertEq(config.delayThreshold, 25);
        assertEq(config.premiumPercentage, 250);
        assertEq(config.protocolFeePercentage, 500);
        assertEq(config.payoutPerIncident, 0.25 ether);
        assertTrue(config.active);

        assertEq(totalPool, 0); // No purchases yet
        assertEq(totalProtocolFees, 0);
        assertTrue(contractActive);
    }

    function testPolicyExists() public {
        assertFalse(factory.policyExists(0));
        
        vm.prank(owner);
        factory.createPolicy("Test Policy", "Test Description", address(0), 10, 100, 1000, 0.1 ether);
        
        assertTrue(factory.policyExists(0));
        assertFalse(factory.policyExists(1));
    }

    function testGetPolicyAddress() public {
        vm.prank(owner);
        uint256 policyId = factory.createPolicy(
            "Address Test Policy",
            "Test Description",
            address(0),
            10,
            100,
            1000,
            0.1 ether
        );

        address payable policyAddress = payable(factory.getPolicyAddress(policyId));
        assertTrue(policyAddress != address(0));
        
        // Verify it's actually a Policy contract
        Policy policyContract = Policy(policyAddress);
        assertEq(policyContract.owner(), owner);
    }

    function testGetPolicyAddressFailsNonexistentPolicy() public {
        vm.expectRevert("Policy does not exist");
        factory.getPolicyAddress(999);
    }

    function testMultiplePoliciesWithDifferentConfigurations() public {
        vm.startPrank(owner);
        
        // Create policies with different configurations
        uint256 policy1 = factory.createPolicy("Conservative", "Low risk", address(0), 5, 50, 500, 0.05 ether);
        uint256 policy2 = factory.createPolicy("Moderate", "Medium risk", address(0), 10, 100, 1000, 0.1 ether);
        uint256 policy3 = factory.createPolicy("Aggressive", "High risk", address(0), 20, 200, 1500, 0.2 ether);
        
        vm.stopPrank();

        // Verify each policy has correct configuration
        (, Policy.PolicyConfig memory config1,,,) = factory.getPolicyDetails(policy1);
        (, Policy.PolicyConfig memory config2,,,) = factory.getPolicyDetails(policy2);
        (, Policy.PolicyConfig memory config3,,,) = factory.getPolicyDetails(policy3);

        assertEq(config1.delayThreshold, 5);
        assertEq(config1.payoutPerIncident, 0.05 ether);

        assertEq(config2.delayThreshold, 10);
        assertEq(config2.payoutPerIncident, 0.1 ether);

        assertEq(config3.delayThreshold, 20);
        assertEq(config3.payoutPerIncident, 0.2 ether);
    }
}
