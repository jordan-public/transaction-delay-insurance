## Transaction Delay Insurance Contracts

This directory contains the smart contracts for the Transaction Delay Insurance system.

## Contracts

### Policy.sol
The main insurance policy contract that handles:
- Insurance share purchases (users deposit ETH to get coverage)
- Claim processing with RPC proxy signature verification
- Payout calculation and distribution
- Protocol fee collection

### PolicyFactory.sol
Factory contract for creating and managing multiple insurance policies:
- Deploy new Policy contracts with different parameters
- Manage policy activation/deactivation
- Provide centralized access to all policies

## Key Features

- **Signature Verification**: Uses ECDSA to verify RPC proxy signatures for delay proofs
- **Flexible Parameters**: Each policy can have different delay thresholds, premiums, and payouts
- **Gas Efficient**: Optimized for minimal gas usage in common operations
- **Security**: Uses OpenZeppelin's ReentrancyGuard and Ownable for security

## Testing

Run the test suite:
```bash
forge test
```

Run tests with verbose output:
```bash
forge test -vvv
```

## Deployment

1. Set environment variables:
```bash
export PRIVATE_KEY=your_private_key
export RPC_PROXY_ADDRESS=your_rpc_proxy_address
```

2. Deploy to local network:
```bash
forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
```

3. Deploy to testnet (example with Sepolia):
```bash
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify --etherscan-api-key $ETHERSCAN_API_KEY
```

## Contract Interaction

### Purchase Insurance
```solidity
// Get quote first
(uint256 premium, uint256 incidentsCovered) = policy.getShareQuote(1 ether);

// Purchase insurance
policy.purchaseShare{value: 1 ether}();
```

### Submit Claim
```solidity
Policy.ClaimProof memory proof = Policy.ClaimProof({
    txHash: transactionHash,
    broadcastBlock: blockWhenSubmitted,
    confirmationBlock: blockWhenConfirmed,
    rpcSignature: signedProofFromRpcProxy
});

policy.submitClaim(proof);
```

## Architecture

The system consists of:
1. **PolicyFactory**: Creates and manages Policy contracts
2. **Policy**: Individual insurance pools with specific parameters
3. **RPC Proxy**: External service that signs delay proofs (not included in this contracts directory)

## Security Considerations

- All external calls are protected against reentrancy
- Signature verification prevents unauthorized claims
- Owner controls are limited to configuration and fee withdrawal
- Factory pattern allows for upgradability through new policy deployments
