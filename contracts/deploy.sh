#!/bin/bash

# Transaction Delay Insurance - Simple Contract Deployment Script
# Usage: ./deploy.sh [local|zircuit|flow|hedera]

set -e

# Load environment variables
if [[ -f ".env" ]]; then
    . ./.env
else
    echo "Error: .env file not found. Copy .env.example to .env and configure it."
    exit 1
fi

# Check for required environment variables
if [[ -z "$PRIVATE_KEY" ]]; then
    echo "Error: PRIVATE_KEY not set in .env file"
    exit 1
fi

if [[ -z "$RPC_PROXY_ADDRESS" ]]; then
    echo "Warning: RPC_PROXY_ADDRESS not set. Using zero address."
    export RPC_PROXY_ADDRESS="0x0000000000000000000000000000000000000000"
fi

# Get network from command line argument
NETWORK=${1:-"local"}

# Network RPC URLs
case "$NETWORK" in
    "local")
        RPC_URL="http://localhost:8545"
        ;;
    "zircuit")
        RPC_URL="https://garfield-testnet.zircuit.com/"
        ;;
    "flow")
        RPC_URL="https://testnet.evm.nodes.onflow.org/"
        ;;
    "hedera")
        RPC_URL="https://testnet.hashio.io/api"
        ;;
    *)
        echo "Usage: ./deploy.sh [local|zircuit|flow|hedera]"
        exit 1
        ;;
esac

echo "Deploying to $NETWORK network..."
echo "RPC URL: $RPC_URL"

# Run tests first
echo "Running tests..."
forge test

# Deploy contracts
echo "Deploying contracts..."
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

echo "Deployment complete!"
echo "Check broadcast/Deploy.s.sol/$NETWORK/ for deployment artifacts"
