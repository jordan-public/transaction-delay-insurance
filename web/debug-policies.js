const { createPublicClient, http } = require('viem');

// Contract ABI for getActivePolicies
const abi = [
  {
    "inputs": [],
    "name": "getActivePolicies",
    "outputs": [
      {
        "internalType": "uint256[]",
        "name": "activePolicyIds",
        "type": "uint256[]"
      },
      {
        "components": [
          {
            "internalType": "address",
            "name": "policyAddress",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "name",
            "type": "string"
          },
          {
            "internalType": "string",
            "name": "description",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "createdAt",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "active",
            "type": "bool"
          }
        ],
        "internalType": "struct PolicyFactory.PolicyInfo[]",
        "name": "policyInfos",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

async function debugPolicies() {
  const client = createPublicClient({
    chain: {
      id: 296,
      name: 'Hedera EVM Testnet',
      rpcUrls: {
        default: {
          http: ['https://testnet.hashio.io/api']
        }
      }
    },
    transport: http('https://testnet.hashio.io/api')
  });

  try {
    console.log('Calling getActivePolicies...');
    const result = await client.readContract({
      address: '0x1ffe05ace98e3a2175d647fbe100062bb190e285',
      abi: abi,
      functionName: 'getActivePolicies',
    });
    
    console.log('Raw result:', result);
    
    if (result && Array.isArray(result) && result.length === 2) {
      const [policyIds, policyInfos] = result;
      console.log('Policy IDs:', policyIds);
      console.log('Policy Infos:', policyInfos);
      
      if (policyIds.length > 0) {
        console.log('Found', policyIds.length, 'active policies:');
        policyIds.forEach((id, index) => {
          const info = policyInfos[index];
          console.log(`Policy ${id}:`, {
            address: info.policyAddress,
            name: info.name,
            description: info.description,
            createdAt: new Date(Number(info.createdAt) * 1000).toISOString(),
            active: info.active
          });
        });
      } else {
        console.log('No active policies found');
      }
    } else {
      console.log('Unexpected result format:', result);
    }
  } catch (error) {
    console.error('Error calling contract:', error);
  }
}

debugPolicies();
