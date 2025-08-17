import React, { useState, useEffect, Component } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { RainbowKitProvider, connectorsForWallets } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { metaMaskWallet } from '@rainbow-me/rainbowkit/wallets';

import Header from './components/Header';
import CreatePolicyForm from './components/CreatePolicyForm';
import PolicyList from './components/PolicyList';
import PurchaseInsurance from './components/PurchaseInsurance';
import SampleTransaction from './components/SampleTransaction';
import InsuranceClaim from './components/InsuranceClaim';

import { NETWORKS } from './config/networks';

// Define Hedera Testnet chain explicitly for Wagmi
const hederaTestnetChain = {
  id: 296,
  name: 'Hedera Testnet',
  nativeCurrency: { name: 'HBAR', symbol: 'HBAR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://testnet.hashio.io/api'] },
  },
  blockExplorers: {
    default: { name: 'HashScan', url: 'https://hashscan.io/testnet' },
  },
  testnet: true,
};

// Configure Wagmi v2 with a minimal, safe wallet set (exclude Coinbase) and disable autoConnect
const walletConnectProjectId = process.env.REACT_APP_WC_PROJECT_ID || 'demo';
const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [metaMaskWallet],
    },
  ],
  {
    appName: 'Transaction Delay Insurance',
  projectId: walletConnectProjectId,
  }
);

const config = createConfig({
  connectors,
  chains: [hederaTestnetChain],
  transports: {
    [hederaTestnetChain.id]: http(hederaTestnetChain.rpcUrls.default.http[0]),
  },
});

// Create query client
const queryClient = new QueryClient();

// Error Boundary for wallet connection issues
class WalletErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error: error };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error for debugging
    console.error('Wallet connection error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      // Check if it's the specific accounts.map error
      const errorString = String(this.state.error || '');
      if (errorString.includes('accounts.map is not a function')) {
        return (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 m-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Wallet Connection Issue
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>
                    There's a temporary issue with wallet connection. Please refresh the page or try a different wallet.
                  </p>
                  <button 
                    onClick={() => window.location.reload()} 
                    className="mt-2 bg-yellow-200 text-yellow-800 px-3 py-1 rounded text-sm hover:bg-yellow-300"
                  >
                    Refresh Page
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // Fallback UI for other errors
      return (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 m-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Something went wrong
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>An error occurred while loading the application.</p>
                <button 
                  onClick={() => this.setState({ hasError: false, error: null })} 
                  className="mt-2 bg-red-200 text-red-800 px-3 py-1 rounded text-sm hover:bg-red-300"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  const currentNetwork = NETWORKS.HEDERA;

  // Get contract addresses for current network
    // Contract Configuration
  const policyFactoryAddress = '0x1ffe05ace98e3a2175d647fbe100062bb190e285'; // Deployed PolicyFactory on Hedera Testnet
  
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
                chainId={hederaTestnetChain.id}
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
                chainId={hederaTestnetChain.id}
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
                chainId={hederaTestnetChain.id}
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
  // Clear any persisted last-used wallet/connector to avoid Coinbase auto-reconnect
  useEffect(() => {
    try {
      const keysToClear = [
        'wagmi.recentConnectorId',
        'rk-last-used-wallet',
        'rainbowkit.recentConnectorId',
      ];
      keysToClear.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  return (
    <WalletErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider>
            <Router>
              <AppContent />
            </Router>
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </WalletErrorBoundary>
  );
};

export default App;
