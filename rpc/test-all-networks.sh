#!/bin/bash

# Comprehensive RPC Proxy Test for All Networks
echo "==================================================================="
echo "🚀 Transaction Delay Insurance RPC Proxy - Multi-Network Test"
echo "==================================================================="
echo ""

# Cleanup function
cleanup_ports() {
    echo "🧹 Cleaning up any existing processes on ports 3001, 3002, 3003..."
    for port in 3001 3002 3003; do
        lsof -ti:$port | xargs kill -9 2>/dev/null || true
    done
    sleep 2
}

# Initial cleanup
cleanup_ports

# Track test results
zircuit_result=""
flow_result=""
hedera_result=""

# Test function for each network
test_network() {
    local network=$1
    local expected_chain_id=$2
    local port=$3
    local test_passed=true
    
    echo "📡 Testing $network..."
    echo "-----------------------------------"
    
    # Kill any existing process on this port
    echo "🧹 Cleaning up any existing process on port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
    
    # Start server for this network
    echo "▶️  Starting $network server on port $port..."
    (cd /Users/jordan/transaction-delay-insurance/rpc && cp .env.$network .env && npm start) &
    SERVER_PID=$!
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    for i in {1..10}; do
        if curl -s http://localhost:$port/health >/dev/null 2>&1; then
            echo "✅ Server started successfully"
            break
        fi
        if [ $i -eq 10 ]; then
            echo "❌ Server failed to start after 10 seconds"
            kill $SERVER_PID 2>/dev/null
            eval "${network}_result=\"❌\""
            return 1
        fi
        sleep 1
    done
    
    # Test health endpoint
    echo "🏥 Testing health endpoint..."
    health_response=$(curl -s -X GET http://localhost:$port/health)
    if [[ $health_response == *"healthy"* ]]; then
        echo "✅ Health check passed"
    else
        echo "❌ Health check failed"
        test_passed=false
    fi
    
    # Test network endpoint
    echo "🌐 Testing network endpoint..."
    network_response=$(curl -s -X GET http://localhost:$port/network)
    if [[ $network_response == *"$expected_chain_id"* ]]; then
        echo "✅ Network info correct (Chain ID: $expected_chain_id)"
    else
        echo "❌ Network info incorrect"
        echo "   Response: $network_response"
        test_passed=false
    fi
    
    # Test current block endpoint
    echo "🔗 Testing current block endpoint..."
    block_response=$(curl -s -X GET http://localhost:$port/block/current)
    if [[ $block_response == *"blockNumber"* ]]; then
        echo "✅ Block endpoint working"
        echo "   Current block: $(echo $block_response | grep -o '"blockNumber":[0-9]*' | cut -d: -f2)"
    else
        echo "❌ Block endpoint failed"
        test_passed=false
    fi
    
    # Test transaction broadcast (should fail with expected errors)
    echo "💸 Testing transaction broadcast..."
    tx_response=$(curl -s -X POST http://localhost:$port/tx/broadcast \
      -H "Content-Type: application/json" \
      -d '{
        "to": "0x1234567890123456789012345678901234567890",
        "value": "1000000000000000",
        "gasLimit": "21000",
        "gasPrice": "20000000000"
      }')
    
    # Check for expected error responses (insufficient funds OR gas price errors)
    if [[ $tx_response == *"insufficient funds"* ]] || [[ $tx_response == *"INSUFFICIENT_FUNDS"* ]] || [[ $tx_response == *"gas price"* ]] || [[ $tx_response == *"minimum gas price"* ]]; then
        echo "✅ Transaction broadcast working (expected error: transaction rejected)"
    else
        echo "❌ Transaction broadcast failed unexpectedly"
        echo "   Response: $tx_response"
        test_passed=false
    fi
    
    # Stop server and cleanup
    echo "🛑 Stopping $network server..."
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    
    # Extra cleanup - kill any remaining process on this port
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
    
    # Record test result
    if [ "$test_passed" = true ]; then
        eval "${network}_result=\"✅\""
        echo "✅ $network testing complete!"
    else
        eval "${network}_result=\"❌\""
        echo "❌ $network testing failed!"
    fi
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
echo "• Zircuit Garfield Testnet (Chain ID: 48898) $zircuit_result"
echo "• Flow EVM Testnet (Chain ID: 545) $flow_result"  
echo "• Hedera EVM Testnet (Chain ID: 296) $hedera_result"
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
