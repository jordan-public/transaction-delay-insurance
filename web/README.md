# Transaction Delay Insurance - Frontend

A React-based frontend application for the Transaction Delay Insurance system, providing interfaces for policy management, insurance purchasing, transaction testing, and claim processing.

## Features

### 🔧 Admin Features
- **Policy Creation**: Create new insurance policies with custom parameters
- **Policy Management**: View and manage existing policies

### 👤 User Features
- **Policy Browser**: View available insurance policies and their terms
- **Insurance Purchase**: Buy insurance coverage for transaction delays
- **Sample Transactions**: Test transaction broadcasting through RPC proxy
- **Insurance Claims**: Submit claims for delayed transactions with automated proof generation

### 🌐 Multi-Network Support
- **Zircuit Garfield Testnet** (Chain ID: 48898)
- **Flow EVM Testnet** (Chain ID: 545)
- **Hedera EVM Testnet** (Chain ID: 296)

## Quick Start

### Prerequisites

- Node.js 16+ and npm
- MetaMask or compatible wallet
- RPC Proxy server running (see `../rpc/README.md`)

### Installation

1. **Install dependencies**:
```bash
npm install
```

2. **Configure networks**:
   - Update contract addresses in `src/config/networks.js`
   - Ensure RPC proxy is running for your target networks

3. **Start the development server**:
```bash
npm start
```

4. **Access the application**:
   - Open [http://localhost:3000](http://localhost:3000)
   - Connect your wallet
   - Switch to a supported testnet

## Configuration

### Contract Addresses

Update the contract addresses in `src/config/networks.js`:

```javascript
export const CONTRACT_ADDRESSES = {
  [NETWORKS.ZIRCUIT.id]: {
    policyFactory: '0x...', // Your deployed PolicyFactory address
    samplePolicy: '0x...',   // Sample policy address
  },
  // ... other networks
};
```

### RPC Proxy Connection

The frontend connects to the RPC proxy servers on:
- Zircuit: `http://localhost:3001`
- Flow: `http://localhost:3002`
- Hedera: `http://localhost:3003`

Ensure the corresponding RPC proxy is running for your target network.

## Application Structure

### Pages & Components

1. **Policy List** (`/`)
   - View all available insurance policies
   - Select policies for purchase or claims

2. **Admin Panel** (`/admin`)
   - Create new insurance policies
   - Configure policy parameters

3. **Purchase Insurance** (`/purchase`)
   - Buy insurance coverage
   - View coverage quotes and terms

4. **Sample Transaction** (`/sample`)
   - Submit test transactions through RPC proxy
   - Monitor transaction broadcasting and delays

5. **Insurance Claims** (`/claim`)
   - Submit claims for delayed transactions
   - Generate and verify delay proofs

### Key Components

- **Header**: Wallet connection and navigation
- **CreatePolicyForm**: Admin policy creation interface
- **PolicyList**: Display and select available policies
- **PurchaseInsurance**: Insurance purchasing workflow
- **SampleTransaction**: Transaction testing interface
- **InsuranceClaim**: Claim submission and proof generation

## Wallet Integration

### Supported Wallets
- MetaMask
- WalletConnect-compatible wallets
- Coinbase Wallet
- Rainbow Wallet

### Network Setup
The app automatically prompts users to add supported testnets to their wallet:

1. **Zircuit Garfield Testnet**
   - RPC: `https://garfield-testnet.zircuit.com/`
   - Chain ID: 48898

2. **Flow EVM Testnet**
   - RPC: `https://testnet.evm.nodes.onflow.org/`
   - Chain ID: 545

3. **Hedera EVM Testnet**
   - RPC: `https://testnet.hashio.io/api`
   - Chain ID: 296

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Lint code

### Project Structure

```
src/
├── components/          # React components
│   ├── Header.js
│   ├── CreatePolicyForm.js
│   ├── PolicyList.js
│   ├── PurchaseInsurance.js
│   ├── SampleTransaction.js
│   └── InsuranceClaim.js
├── config/              # Configuration files
│   └── networks.js      # Network configurations
├── hooks/               # Custom React hooks
│   └── useRpcProxy.js   # RPC proxy integration
├── App.js               # Main application component
├── index.js             # Application entry point
└── index.css            # Global styles
```

## Integration with Backend

### RPC Proxy Integration
The frontend integrates with the RPC proxy for:
- Transaction broadcasting with delay tracking
- Delay proof generation for claims
- Transaction status monitoring

### Smart Contract Integration
- **PolicyFactory**: Create and manage policies
- **Policy Contracts**: Purchase insurance and submit claims
- **Automatic ABI handling**: Contract interaction through wagmi

## Testing

### Manual Testing Workflow

1. **Start RPC Proxy**: Ensure proxy is running for target network
2. **Connect Wallet**: Connect to the appropriate testnet
3. **Create Policy** (Admin): Set up insurance policies
4. **Purchase Insurance**: Buy coverage with test ETH
5. **Submit Transaction**: Use sample transaction feature
6. **Submit Claim**: If transaction is delayed, submit a claim

### Test Data

Use the provided test mnemonics for development:
```
test test test test test test test test test test test junk
```

## Deployment

### Production Build

```bash
npm run build
```

### Environment Variables

Create a `.env` file for production configuration:

```bash
REACT_APP_WALLETCONNECT_PROJECT_ID=your_project_id
REACT_APP_RPC_PROXY_BASE_URL=https://your-proxy-domain.com
```

### Hosting

The built application can be deployed to:
- Vercel
- Netlify
- GitHub Pages
- Any static hosting service

## Troubleshooting

### Common Issues

1. **Wallet Connection Failed**
   - Ensure wallet is installed and unlocked
   - Check if the correct network is selected

2. **RPC Proxy Connection Failed**
   - Verify proxy server is running
   - Check firewall/CORS settings

3. **Transaction Failures**
   - Ensure sufficient test ETH for gas
   - Verify contract addresses are correct

4. **Contract Interaction Errors**
   - Check contract ABIs are up to date
   - Verify contract addresses match deployed contracts

### Getting Help

- Check browser console for detailed error messages
- Verify RPC proxy health endpoints
- Ensure wallet is connected to the correct network

## License

This project is part of the Transaction Delay Insurance system.
