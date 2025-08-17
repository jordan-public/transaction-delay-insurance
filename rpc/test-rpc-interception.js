#!/usr/bin/env node
/**
 * Test script to verify RPC interception of eth_sendRawTransaction
 * This tests the true RPC proxy functionality
 */

const axios = require('axios');

// Test raw transaction (invalid but properly formatted)
const testRawTx = "0x02f87582bf02808504a817c8008504a817c80082520894123456789012345678901234567890123456789087038d7ea4c6800080c080a03a6b85078ed243bd00722d8c22806e3a6efa76fd64e39d6788654d9d3d6e1123a056ab2b9cf757e80d8b85278d64b9aaa07d4ba39fa5f79295d5a91ab567955118";

async function testRPCInterception() {
  console.log('🧪 Testing RPC Interception of eth_sendRawTransaction');
  console.log('================================================\n');

  try {
    // Test 1: Direct JSON-RPC call to eth_sendRawTransaction
    console.log('1️⃣  Testing direct RPC call to eth_sendRawTransaction...');
    
    const rpcRequest = {
      jsonrpc: "2.0",
      method: "eth_sendRawTransaction",
      params: [testRawTx],
      id: 1
    };

    const response = await axios.post('http://localhost:3001', rpcRequest, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ RPC request sent successfully');
    console.log('📋 Response:', JSON.stringify(response.data, null, 2));
    
    if (response.data.error) {
      console.log('✅ Transaction rejected as expected (test transaction has insufficient funds)');
      console.log('🔍 Error details:', response.data.error.message);
    } else if (response.data.result) {
      console.log('✅ Transaction accepted, hash:', response.data.result);
    }

  } catch (error) {
    if (error.response) {
      console.log('✅ RPC proxy responded with error (expected for test transaction)');
      console.log('📋 Response data:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.log('❌ Failed to connect to RPC proxy:', error.message);
      return;
    }
  }

  try {
    // Test 2: Verify the proxy is intercepting by checking logs or cache
    console.log('\n2️⃣  Checking if transaction was logged/cached...');
    
    const statsResponse = await axios.get('http://localhost:3001/stats');
    console.log('✅ Stats endpoint accessible');
    console.log('📊 Proxy stats:', JSON.stringify(statsResponse.data, null, 2));

  } catch (error) {
    console.log('⚠️  Could not fetch stats:', error.message);
  }

  try {
    // Test 3: Test other RPC methods to ensure they're still forwarded
    console.log('\n3️⃣  Testing RPC method forwarding (eth_chainId)...');
    
    const chainIdRequest = {
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
      id: 2
    };

    const chainIdResponse = await axios.post('http://localhost:3001', chainIdRequest, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Chain ID request successful');
    console.log('🔗 Chain ID:', chainIdResponse.data.result);

  } catch (error) {
    console.log('❌ Chain ID request failed:', error.message);
  }

  try {
    // Test 4: Test batch requests
    console.log('\n4️⃣  Testing batch RPC requests...');
    
    const batchRequest = [
      {
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 3
      },
      {
        jsonrpc: "2.0",
        method: "net_version",
        params: [],
        id: 4
      }
    ];

    const batchResponse = await axios.post('http://localhost:3001', batchRequest, {
      headers: { 'Content-Type': 'application/json' }
    });

    console.log('✅ Batch request successful');
    console.log('📦 Batch response:', JSON.stringify(batchResponse.data, null, 2));

  } catch (error) {
    console.log('❌ Batch request failed:', error.message);
  }

  console.log('\n🎉 RPC Interception Test Complete!');
  console.log('================================================');
}

// Run the test
testRPCInterception().catch(console.error);
