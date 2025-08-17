/* eslint-disable no-console */
import { createPublicClient, http } from 'viem';

const hedera = {
  id: 296,
  name: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet.hashio.io/api'] } },
};

const POLICY_FACTORY_ABI = [
  {
    inputs: [],
    name: 'getActivePolicies',
    outputs: [
      { type: 'uint256[]' },
      {
        type: 'tuple[]',
        components: [
          { name: 'policyAddress', type: 'address' },
          { name: 'name', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'active', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  const client = createPublicClient({ chain: hedera, transport: http(hedera.rpcUrls.default.http[0]) });
  const address = '0x1ffe05ace98e3a2175d647fbe100062bb190e285';
  try {
    const res = await client.readContract({
      address,
      abi: POLICY_FACTORY_ABI,
      functionName: 'getActivePolicies',
    });
    console.log('getActivePolicies result:', res);
    if (Array.isArray(res) && res.length >= 2) {
      const [ids, infos] = res;
      console.log('ids:', ids);
      console.log('infos[0]:', infos?.[0]);
    }
  } catch (e) {
    console.error('Error reading contract:', e);
    process.exitCode = 1;
  }
}

main();
