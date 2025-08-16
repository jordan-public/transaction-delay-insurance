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

### Quick Deployment with Script

Use the provided deployment script for easy deployment to supported networks:

```bash
# Deploy to local network
./deploy.sh --network local --private-key YOUR_PRIVATE_KEY

# Deploy to Zircuit testnet
./deploy.sh --network zircuit --private-key YOUR_PRIVATE_KEY --rpc-proxy YOUR_RPC_PROXY_ADDRESS

# Deploy to Flow EVM testnet
./deploy.sh --network flow --private-key YOUR_PRIVATE_KEY --rpc-proxy YOUR_RPC_PROXY_ADDRESS

# Deploy to Hedera EVM testnet  
./deploy.sh --network hedera --private-key YOUR_PRIVATE_KEY --rpc-proxy YOUR_RPC_PROXY_ADDRESS

# Deploy with contract verification (if supported)
./deploy.sh --network zircuit --verify --etherscan-key YOUR_ETHERSCAN_API_KEY
```

### Supported Networks

- `local` - Local development network (http://localhost:8545)
- `zircuit` - Zircuit testnet
- `flow` - Flow EVM testnet
- `hedera` - Hedera EVM testnet

### Environment Variables

Alternatively, you can set environment variables instead of using flags:

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your values
export PRIVATE_KEY=your_private_key
export RPC_PROXY_ADDRESS=your_rpc_proxy_address
export ETHERSCAN_API_KEY=your_etherscan_api_key

# Deploy using environment variables
./deploy.sh --network zircuit --verify
```

### Manual Deployment with Forge

For custom configurations or other networks:

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export RPC_PROXY_ADDRESS=your_rpc_proxy_address

# Deploy to any network
forge script script/Deploy.s.sol --rpc-url YOUR_RPC_URL --broadcast

# With verification
forge script script/Deploy.s.sol --rpc-url YOUR_RPC_URL --broadcast --verify --etherscan-api-key YOUR_ETHERSCAN_API_KEY
```

### Deployment Script Features

The `deploy.sh` script provides:
- ✅ Pre-deployment test execution
- 🌐 Multi-network support (local, Zircuit, Flow, Hedera)
- 🔍 Optional contract verification
- 📋 Automatic address extraction from deployment artifacts
- 🎨 Colored output for better readability
- ⚡ Input validation and error handling
- 📖 Comprehensive help documentation

Use `./deploy.sh --help` for detailed usage information.

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
