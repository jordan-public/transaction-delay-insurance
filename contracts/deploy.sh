#!/bin/bash

# Transaction Delay Insurance - Contract Deployment Script
# Supports deployment to multiple networks including Zircuit, Flow, and Hedera testnets

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to get RPC URL for network
get_rpc_url() {
    case "$1" in
        "local")
            echo "http://localhost:8545"
            ;;
        "zircuit")
            echo "https://zircuit-testnet.drpc.org"
            ;;
        "flow")
            echo "https://testnet.evm.flow.org"
            ;;
        "hedera")
            echo "https://testnet.hashio.io/api"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Function to check if network is supported
is_network_supported() {
    local network="$1"
    case "$network" in
        "local"|"zircuit"|"flow"|"hedera")
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Default values
NETWORK=""
VERIFY=""
ETHERSCAN_API_KEY=""
PRIVATE_KEY=""
RPC_PROXY_ADDRESS=""

# Function to print usage
usage() {
    echo -e "${BLUE}Usage: $0 [OPTIONS]${NC}"
    echo ""
    echo "Options:"
    echo "  -n, --network NETWORK     Target network (local, zircuit, flow, hedera)"
    echo "  -v, --verify             Verify contracts on Etherscan (if supported)"
    echo "  -k, --private-key KEY    Private key for deployment (or set PRIVATE_KEY env)"
    echo "  -p, --rpc-proxy ADDR     RPC proxy address (or set RPC_PROXY_ADDRESS env)"
    echo "  -e, --etherscan-key KEY  Etherscan API key for verification"
    echo "  -h, --help               Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --network local"
    echo "  $0 --network zircuit --verify --etherscan-key YOUR_KEY"
    echo "  $0 --network flow --rpc-proxy 0x1234..."
    echo ""
    echo "Supported networks: local, zircuit, flow, hedera"
    echo ""
    echo "Environment Variables:"
    echo "  PRIVATE_KEY              Deployer private key"
    echo "  RPC_PROXY_ADDRESS        Address of the RPC proxy service"
    echo "  ETHERSCAN_API_KEY        API key for contract verification"
}

# Function to validate inputs
validate_inputs() {
    if [[ -z "$NETWORK" ]]; then
        echo -e "${RED}Error: Network is required${NC}"
        usage
        exit 1
    fi

    if ! is_network_supported "$NETWORK"; then
        echo -e "${RED}Error: Unsupported network '$NETWORK'${NC}"
        echo "Supported networks: local, zircuit, flow, hedera"
        exit 1
    fi

    # Check for private key
    if [[ -z "$PRIVATE_KEY" ]]; then
        PRIVATE_KEY="$PRIVATE_KEY_ENV"
    fi
    
    if [[ -z "$PRIVATE_KEY" ]]; then
        echo -e "${RED}Error: Private key is required (use -k flag or PRIVATE_KEY env var)${NC}"
        exit 1
    fi

    # Check for RPC proxy address
    if [[ -z "$RPC_PROXY_ADDRESS" ]]; then
        RPC_PROXY_ADDRESS="$RPC_PROXY_ADDRESS_ENV"
    fi
    
    if [[ -z "$RPC_PROXY_ADDRESS" ]]; then
        echo -e "${YELLOW}Warning: No RPC proxy address provided. Using zero address as default.${NC}"
        RPC_PROXY_ADDRESS="0x0000000000000000000000000000000000000000"
    fi
}

# Function to deploy contracts
deploy() {
    local rpc_url=$(get_rpc_url "$NETWORK")
    
    if [[ -z "$rpc_url" ]]; then
        echo -e "${RED}Error: Could not get RPC URL for network $NETWORK${NC}"
        exit 1
    fi
    
    echo -e "${BLUE}Starting deployment to $NETWORK...${NC}"
    echo "RPC URL: $rpc_url"
    echo "RPC Proxy Address: $RPC_PROXY_ADDRESS"
    echo ""

    # Export environment variables for the forge script
    export PRIVATE_KEY="$PRIVATE_KEY"
    export RPC_PROXY_ADDRESS="$RPC_PROXY_ADDRESS"

    # Build the forge command
    local forge_cmd="forge script script/Deploy.s.sol --rpc-url $rpc_url --broadcast"
    
    # Add verification if requested and supported
    if [[ "$VERIFY" == "true" && -n "$ETHERSCAN_API_KEY" ]]; then
        forge_cmd="$forge_cmd --verify --etherscan-api-key $ETHERSCAN_API_KEY"
        echo -e "${YELLOW}Contract verification enabled${NC}"
    fi

    echo -e "${BLUE}Executing: $forge_cmd${NC}"
    echo ""

    # Execute deployment
    if eval "$forge_cmd"; then
        echo ""
        echo -e "${GREEN}✅ Deployment successful!${NC}"
        
        # Show deployment artifacts location
        echo ""
        echo -e "${BLUE}Deployment artifacts saved to:${NC}"
        echo "  broadcast/Deploy.s.sol/$NETWORK/"
        
        # Extract deployed addresses from the latest run
        local latest_run=$(find broadcast/Deploy.s.sol/$NETWORK -name "run-latest.json" 2>/dev/null)
        if [[ -f "$latest_run" ]]; then
            echo ""
            echo -e "${BLUE}Deployed contract addresses:${NC}"
            # Extract contract addresses using jq if available
            if command -v jq &> /dev/null; then
                jq -r '.transactions[] | select(.transactionType == "CREATE") | "\(.contractName): \(.contractAddress)"' "$latest_run"
            else
                echo "Install 'jq' to automatically extract contract addresses"
                echo "Check the file: $latest_run"
            fi
        fi
        
    else
        echo ""
        echo -e "${RED}❌ Deployment failed!${NC}"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--network)
            NETWORK="$2"
            shift 2
            ;;
        -v|--verify)
            VERIFY="true"
            shift
            ;;
        -k|--private-key)
            PRIVATE_KEY="$2"
            shift 2
            ;;
        -p|--rpc-proxy)
            RPC_PROXY_ADDRESS="$2"
            shift 2
            ;;
        -e|--etherscan-key)
            ETHERSCAN_API_KEY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            usage
            exit 1
            ;;
    esac
done

# Load environment variables if not provided via flags
PRIVATE_KEY_ENV="${PRIVATE_KEY:-$PRIVATE_KEY}"
RPC_PROXY_ADDRESS_ENV="${RPC_PROXY_ADDRESS:-$RPC_PROXY_ADDRESS}"

# Validate inputs
validate_inputs

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo -e "${RED}Error: Foundry forge is not installed${NC}"
    echo "Install from: https://getfoundry.sh/"
    exit 1
fi

# Check if we're in the contracts directory
if [[ ! -f "foundry.toml" ]]; then
    echo -e "${RED}Error: Please run this script from the contracts directory${NC}"
    exit 1
fi

# Run tests before deployment
echo -e "${BLUE}Running tests before deployment...${NC}"
if forge test; then
    echo -e "${GREEN}✅ All tests passed${NC}"
    echo ""
else
    echo -e "${RED}❌ Tests failed. Please fix before deploying.${NC}"
    exit 1
fi

# Deploy contracts
deploy

echo ""
echo -e "${GREEN}🚀 Deployment complete!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Update your RPC proxy configuration with the deployed PolicyFactory address"
echo "2. Update your frontend configuration with the contract addresses"
echo "3. Test the deployment by creating a policy and purchasing insurance"
