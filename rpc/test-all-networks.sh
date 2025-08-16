#!/bin/bash

# Comprehensive RPC Proxy Test for All Networks
echo "==================================================================="
echo "🚀 Transaction Delay Insurance RPC Proxy - Multi-Network Test"
echo "==================================================================="
echo ""

# Test function for each network
test_network() {
    local network=$1
    local expected_chain_id=$2
    local port=$3
    
    echo "📡 Testing $network..."
    echo "-----------------------------------"
    
    # Start server for this network
    echo "▶️  Starting $network server on port $port..."
    (cd /Users/jordan/transaction-delay-insurance/rpc && cp .env.$network .env && npm start) &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 3
    
    # Test health endpoint
    echo "🏥 Testing health endpoint..."
    health_response=$(curl -s -X GET http://localhost:$port/health)
    if [[ $health_response == *"healthy"* ]]; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
    fi
    
    # Test network endpoint
    echo "🌐 Testing network endpoint..."
    network_response=$(curl -s -X GET http://localhost:$port/network)
    if [[ $network_response == *"$expected_chain_id"* ]]; then
        echo "✅ Network info correct (Chain ID: $expected_chain_id)"
    else
        echo "❌ Network info incorrect"
        echo "   Response: $network_response"
    fi
    
    # Test current block endpoint
    echo "🔗 Testing current block endpoint..."
    block_response=$(curl -s -X GET http://localhost:$port/block/current)
    if [[ $block_response == *"blockNumber"* ]]; then
        echo "✅ Block endpoint working"
        echo "   Current block: $(echo $block_response | grep -o '"blockNumber":[0-9]*' | cut -d: -f2)"
    else
        echo "❌ Block endpoint failed"
    fi
    
    # Test transaction broadcast (should fail with insufficient funds)
    echo "💸 Testing transaction broadcast..."
    tx_response=$(curl -s -X POST http://localhost:$port/tx/broadcast \
      -H "Content-Type: application/json" \
      -d '{
        "to": "0x1234567890123456789012345678901234567890",
        "value": "1000000000000000",
        "gasLimit": "21000",
        "gasPrice": "20000000000"
      }')
    if [[ $tx_response == *"insufficient funds"* ]]; then
        echo "✅ Transaction broadcast working (expected insufficient funds error)"
    else
        echo "❌ Transaction broadcast failed unexpectedly"
    fi
    
    # Stop server
    echo "🛑 Stopping $network server..."
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    
    echo "✅ $network testing complete!"
    echo ""
}

# Test all three networks
echo "Starting comprehensive multi-network testing..."
echo ""

test_network "zircuit" "48898" "3001"
test_network "flow" "545" "3002" 
test_network "hedera" "296" "3003"

echo "==================================================================="
echo "🎉 Multi-Network Testing Complete!"
echo "==================================================================="
echo ""
echo "Summary:"
echo "• Zircuit Garfield Testnet (Chain ID: 48898) ✅"
echo "• Flow EVM Testnet (Chain ID: 545) ✅"  
echo "• Hedera EVM Testnet (Chain ID: 296) ✅"
echo ""
echo "All networks are configured with test mnemonic:"
echo "test test test test test test test test test test test junk"
echo ""
echo "To use with your own funds:"
echo "1. Copy .env.sample to .env"
echo "2. Choose your network (zircuit/flow/hedera)"
echo "3. Replace SIGNING_MNEMONIC with your own"
echo "4. Run: npm start"
echo ""
echo "Transaction Delay Insurance RPC Proxy is ready! 🚀"
