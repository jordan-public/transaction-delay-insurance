import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { WagmiConfig, createConfig, configureChains } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { RainbowKitProvider, getDefaultWallets, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import Header from './components/Header';
import CreatePolicyForm from './components/CreatePolicyForm';
import PolicyList from './components/PolicyList';
import PurchaseInsurance from './components/PurchaseInsurance';
import SampleTransaction from './components/SampleTransaction';
import InsuranceClaim from './components/InsuranceClaim';

import { NETWORKS, getNetworkById } from './config/networks';
import { useRpcProxy } from './hooks/useRpcProxy';

// Configure chains
const { chains, publicClient } = configureChains(
  [
    {
      id: NETWORKS.ZIRCUIT.id,
      name: NETWORKS.ZIRCUIT.name,
      network: 'zircuit-testnet',
      nativeCurrency: NETWORKS.ZIRCUIT.nativeCurrency,
      rpcUrls: {
        default: { http: [NETWORKS.ZIRCUIT.rpcUrl] },
        public: { http: [NETWORKS.ZIRCUIT.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'Zircuit Explorer', url: NETWORKS.ZIRCUIT.blockExplorer },
      },
      testnet: true,
    },
    {
      id: NETWORKS.FLOW.id,
      name: NETWORKS.FLOW.name,
      network: 'flow-testnet',
      nativeCurrency: NETWORKS.FLOW.nativeCurrency,
      rpcUrls: {
        default: { http: [NETWORKS.FLOW.rpcUrl] },
        public: { http: [NETWORKS.FLOW.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'Flow Explorer', url: NETWORKS.FLOW.blockExplorer },
      },
      testnet: true,
    },
    {
      id: NETWORKS.HEDERA.id,
      name: NETWORKS.HEDERA.name,
      network: 'hedera-testnet',
      nativeCurrency: NETWORKS.HEDERA.nativeCurrency,
      rpcUrls: {
        default: { http: [NETWORKS.HEDERA.rpcUrl] },
        public: { http: [NETWORKS.HEDERA.rpcUrl] },
      },
      blockExplorers: {
        default: { name: 'Hedera Explorer', url: NETWORKS.HEDERA.blockExplorer },
      },
      testnet: true,
    },
  ],
  [publicProvider()]
);

// Configure wallets
const { wallets } = getDefaultWallets({
  appName: 'Transaction Delay Insurance',
  projectId: 'your-project-id', // Replace with your WalletConnect project ID
  chains,
});

const connectors = connectorsForWallets(wallets);

// Create wagmi config
const wagmiConfig = createConfig({
  autoConnect: true,
  connectors,
  publicClient,
});

// Create query client
const queryClient = new QueryClient();

// Sample ABIs (replace with actual contract ABIs)
const POLICY_FACTORY_ABI = [
  // Add your PolicyFactory ABI here
  {
    "inputs": [],
    "name": "getActivePolicies",
    "outputs": [
      {"type": "uint256[]"},
      {"type": "tuple[]", "components": [
        {"name": "policyAddress", "type": "address"},
        {"name": "name", "type": "string"},
        {"name": "description", "type": "string"},
        {"name": "createdAt", "type": "uint256"},
        {"name": "active", "type": "bool"}
      ]}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "name", "type": "string"},
      {"name": "description", "type": "string"},
      {"name": "rpcProxyAddress", "type": "address"},
      {"name": "delayThreshold", "type": "uint256"},
      {"name": "premiumPercentage", "type": "uint256"},
      {"name": "protocolFeePercentage", "type": "uint256"},
      {"name": "payoutPerIncident", "type": "uint256"}
    ],
    "name": "createPolicy",
    "outputs": [{"type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const POLICY_ABI = [
  // Add your Policy ABI here
  {
    "inputs": [{"type": "address"}],
    "name": "getUserInsurance",
    "outputs": [
      {"name": "ethDeposited", "type": "uint256"},
      {"name": "incidentsRemaining", "type": "uint256"},
      {"name": "lastClaimBlock", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "purchaseShare",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"type": "tuple", "components": [
        {"name": "txHash", "type": "bytes32"},
        {"name": "broadcastBlock", "type": "uint256"},
        {"name": "confirmationBlock", "type": "uint256"},
        {"name": "rpcSignature", "type": "bytes"}
      ]}
    ],
    "name": "submitClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// Navigation component
const Navigation = () => {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Policies', icon: '📋' },
    { path: '/admin', label: 'Admin', icon: '⚙️' },
    { path: '/purchase', label: 'Purchase', icon: '💰' },
    { path: '/sample', label: 'Sample Tx', icon: '🔄' },
    { path: '/claim', label: 'Claim', icon: '📄' },
  ];

  return (
    <nav className="bg-gray-50 border-b border-gray-200">
      <div className="container">
        <div className="flex space-x-8 py-4">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

// Main App component
const AppContent = () => {
  const [selectedPolicy, setSelectedPolicy] = useState(null);
  const [currentNetwork, setCurrentNetwork] = useState(NETWORKS.ZIRCUIT);

  // Get contract addresses for current network
  const policyFactoryAddress = '0x...'; // Replace with actual deployed address
  
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <Navigation />
      
      <main className="container py-8">
        <Routes>
          <Route path="/" element={
            <div className="space-y-8">
              <PolicyList
                policyFactoryAddress={policyFactoryAddress}
                policyFactoryAbi={POLICY_FACTORY_ABI}
                onPolicySelect={setSelectedPolicy}
              />
            </div>
          } />
          
          <Route path="/admin" element={
            <div className="space-y-8">
              <CreatePolicyForm
                policyFactoryAddress={policyFactoryAddress}
                policyFactoryAbi={POLICY_FACTORY_ABI}
                onPolicyCreated={() => {
                  // Refresh policies list
                }}
              />
            </div>
          } />
          
          <Route path="/purchase" element={
            <div className="space-y-8">
              <PolicyList
                policyFactoryAddress={policyFactoryAddress}
                policyFactoryAbi={POLICY_FACTORY_ABI}
                onPolicySelect={setSelectedPolicy}
              />
              <PurchaseInsurance
                policy={selectedPolicy}
                policyAbi={POLICY_ABI}
              />
            </div>
          } />
          
          <Route path="/sample" element={
            <SampleTransaction network={currentNetwork} />
          } />
          
          <Route path="/claim" element={
            <div className="space-y-8">
              <PolicyList
                policyFactoryAddress={policyFactoryAddress}
                policyFactoryAbi={POLICY_FACTORY_ABI}
                onPolicySelect={setSelectedPolicy}
              />
              <InsuranceClaim
                policy={selectedPolicy}
                policyAbi={POLICY_ABI}
                network={currentNetwork}
              />
            </div>
          } />
        </Routes>
      </main>
      
      <Toaster position="top-right" />
    </div>
  );
};

const App = () => {
  return (
    <WagmiConfig config={wagmiConfig}>
      <RainbowKitProvider chains={chains}>
        <QueryClientProvider client={queryClient}>
          <Router>
            <AppContent />
          </Router>
        </QueryClientProvider>
      </RainbowKitProvider>
    </WagmiConfig>
  );
};

export default App;
