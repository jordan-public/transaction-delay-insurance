// Network configurations
export const NETWORKS = {
  ZIRCUIT: {
    id: 48898,
    name: 'Zircuit Garfield Testnet',
    rpcUrl: 'https://garfield-testnet.zircuit.com/',
    blockExplorer: 'https://explorer.garfield-testnet.zircuit.com/',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    proxyPort: 3001,
  },
  FLOW: {
    id: 545,
    name: 'Flow EVM Testnet',
    rpcUrl: 'https://testnet.evm.nodes.onflow.org/',
    blockExplorer: 'https://evm-testnet.flowscan.org/',
    nativeCurrency: {
      name: 'FLOW',
      symbol: 'FLOW',
      decimals: 18,
    },
    proxyPort: 3002,
  },
  HEDERA: {
    id: 296,
    name: 'Hedera EVM Testnet',
    rpcUrl: 'https://testnet.hashio.io/api',
    blockExplorer: 'https://hashscan.io/testnet/',
    nativeCurrency: {
      name: 'HBAR',
      symbol: 'HBAR',
      decimals: 18,
    },
    proxyPort: 3003,
  },
};

// Default network
export const DEFAULT_NETWORK = NETWORKS.ZIRCUIT;

// RPC Proxy base URL
export const RPC_PROXY_BASE_URL = 'http://localhost';

// Contract addresses (these would be deployed contract addresses)
export const CONTRACT_ADDRESSES = {
  [NETWORKS.ZIRCUIT.id]: {
    policyFactory: '0x...', // Replace with actual deployed addresses
    samplePolicy: '0x...',
  },
  [NETWORKS.FLOW.id]: {
    policyFactory: '0x...',
    samplePolicy: '0x...',
  },
  [NETWORKS.HEDERA.id]: {
    policyFactory: '0x...',
    samplePolicy: '0x...',
  },
};

// Get RPC proxy URL for a network
export const getRpcProxyUrl = (network) => {
  return `${RPC_PROXY_BASE_URL}:${network.proxyPort}`;
};

// Get network by chain ID
export const getNetworkById = (chainId) => {
  return Object.values(NETWORKS).find(network => network.id === chainId);
};

// Get contract addresses for a network
export const getContractAddresses = (chainId) => {
  return CONTRACT_ADDRESSES[chainId] || {};
};
