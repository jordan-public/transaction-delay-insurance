// RPC Proxy base URL from env
export const RPC_PROXY_BASE_URL = process.env.REACT_APP_RPC_PROXY_BASE_URL || 'http://localhost';

// Helpers to parse env safely
const num = (v, d) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : d;
};

const fromEnv = {
  ZIRCUIT: {
    id: num(process.env.REACT_APP_ZIRCUIT_CHAIN_ID, 48898),
    name: process.env.REACT_APP_ZIRCUIT_NETWORK_NAME || 'Zircuit Garfield Testnet',
    rpcUrl: process.env.REACT_APP_ZIRCUIT_RPC_URL || 'https://garfield-testnet.zircuit.com/',
    blockExplorer: process.env.REACT_APP_ZIRCUIT_BLOCK_EXPLORER || 'https://explorer.garfield-testnet.zircuit.com/',
    proxyPort: num(process.env.REACT_APP_ZIRCUIT_PROXY_PORT, 3001),
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  },
  FLOW: {
    id: num(process.env.REACT_APP_FLOW_CHAIN_ID, 545),
    name: process.env.REACT_APP_FLOW_NETWORK_NAME || 'Flow EVM Testnet',
    rpcUrl: process.env.REACT_APP_FLOW_RPC_URL || 'https://testnet.evm.nodes.onflow.org/',
    blockExplorer: process.env.REACT_APP_FLOW_BLOCK_EXPLORER || 'https://evm-testnet.flowscan.org/',
    proxyPort: num(process.env.REACT_APP_FLOW_PROXY_PORT, 3002),
    nativeCurrency: { name: 'FLOW', symbol: 'FLOW', decimals: 18 },
  },
  HEDERA: {
    id: num(process.env.REACT_APP_HEDERA_CHAIN_ID, 296),
    name: process.env.REACT_APP_HEDERA_NETWORK_NAME || 'Hedera EVM Testnet',
    rpcUrl: process.env.REACT_APP_HEDERA_RPC_URL || 'https://testnet.hashio.io/api',
    blockExplorer: process.env.REACT_APP_HEDERA_BLOCK_EXPLORER || 'https://hashscan.io/testnet/',
    proxyPort: num(process.env.REACT_APP_HEDERA_PROXY_PORT, 3003),
    nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  },
  LOCAL: {
    id: num(process.env.REACT_APP_LOCAL_CHAIN_ID, 31337),
    name: process.env.REACT_APP_LOCAL_NETWORK_NAME || 'Local Anvil',
    rpcUrl: process.env.REACT_APP_LOCAL_RPC_URL || 'http://localhost:8545',
    blockExplorer: process.env.REACT_APP_LOCAL_BLOCK_EXPLORER || '',
    proxyPort: num(process.env.REACT_APP_LOCAL_PROXY_PORT, 3004),
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  },
};

// Network configurations
export const NETWORKS = {
  ZIRCUIT: fromEnv.ZIRCUIT,
  FLOW: fromEnv.FLOW,
  HEDERA: fromEnv.HEDERA,
  LOCAL: fromEnv.LOCAL,
};

// Default network from env
const defaultKey = (process.env.REACT_APP_NETWORK || 'zircuit').toUpperCase();
export const DEFAULT_NETWORK = NETWORKS[defaultKey] || NETWORKS.ZIRCUIT;

// Contract addresses (these would be deployed contract addresses)
export const CONTRACT_ADDRESSES = {
  [NETWORKS.ZIRCUIT.id]: {
    policyFactory: process.env.REACT_APP_ZIRCUIT_POLICY_FACTORY || '0x0000000000000000000000000000000000000000',
    samplePolicy: process.env.REACT_APP_ZIRCUIT_SAMPLE_POLICY || '0x0000000000000000000000000000000000000000',
  },
  [NETWORKS.FLOW.id]: {
    policyFactory: process.env.REACT_APP_FLOW_POLICY_FACTORY || '0x0000000000000000000000000000000000000000',
    samplePolicy: process.env.REACT_APP_FLOW_SAMPLE_POLICY || '0x0000000000000000000000000000000000000000',
  },
  [NETWORKS.HEDERA.id]: {
    policyFactory: process.env.REACT_APP_HEDERA_POLICY_FACTORY || '0x0000000000000000000000000000000000000000',
    samplePolicy: process.env.REACT_APP_HEDERA_SAMPLE_POLICY || '0x0000000000000000000000000000000000000000',
  },
  [NETWORKS.LOCAL.id]: {
    policyFactory: process.env.REACT_APP_LOCAL_POLICY_FACTORY || '0x0000000000000000000000000000000000000000',
    samplePolicy: process.env.REACT_APP_LOCAL_SAMPLE_POLICY || '0x0000000000000000000000000000000000000000',
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
