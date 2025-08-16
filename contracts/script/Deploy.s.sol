// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyFactory.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy PolicyFactory
        // Note: Replace with actual RPC proxy address when available
        address rpcProxyAddress = vm.envAddress("RPC_PROXY_ADDRESS");
        
        PolicyFactory factory = new PolicyFactory(deployer, rpcProxyAddress);
        
        console.log("PolicyFactory deployed to:", address(factory));

        // Create a default policy
        uint256 policyId = factory.createPolicy(
            "Standard Delay Insurance",
            "Standard policy for transaction delay protection with 10-block threshold",
            address(0), // Use default RPC proxy
            10, // 10 blocks delay threshold
            100, // 1% premium
            1000, // 10% protocol fee
            0.1 ether // 0.1 ETH payout per incident
        );

        address policyAddress = factory.getPolicyAddress(policyId);
        console.log("Default Policy created with ID:", policyId);
        console.log("Default Policy address:", policyAddress);

        vm.stopBroadcast();
    }
}
