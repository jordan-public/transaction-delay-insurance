# RPC Proxy for Transaction Delay Insurance

A Node.js RPC proxy server that tracks transaction broadcast and confirmation times, providing cryptographic proofs of delays for insurance claims.

## Features

- **Multi-Network Support**: Supports Zircuit, Flow EVM, and Hedera EVM testnets
- **Transaction Tracking**: Records broadcast and confirmation block numbers
- **Delay Proofs**: Generates cryptographically signed delay proofs
- **Caching**: In-memory transaction cache with automatic cleanup
- **Rate Limiting**: Built-in rate limiting for API protection
- **Comprehensive Logging**: Structured logging with Winston
- **Health Monitoring**: Health checks and statistics endpoints

## Quick Start

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
# Copy pre-configured network settings to active .env file
cp .env.zircuit .env    # Use Zircuit Garfield testnet
# OR
cp .env.flow .env       # Use Flow EVM testnet  
# OR
cp .env.hedera .env     # Use Hedera EVM testnet

# For production: Replace test mnemonic with your own
nano .env
```

3. **Start the server**:
```bash
npm start
# OR for development with auto-reload
npm run dev
```

## Configuration

### Environment File Structure

The proxy uses a modular environment configuration system:

- **`.env.sample`** - Template file showing all configuration options (do not use directly)
- **`.env.zircuit`** - Pre-configured for Zircuit Garfield Testnet
- **`.env.flow`** - Pre-configured for Flow EVM Testnet  
- **`.env.hedera`** - Pre-configured for Hedera EVM Testnet
- **`.env`** - **Active configuration file** (the only file the application reads)

### Quick Network Switching

To switch networks, simply copy the desired configuration to the active `.env` file:

```bash
# Use Zircuit Garfield testnet
cp .env.zircuit .env

# Use Flow EVM testnet
cp .env.flow .env

# Use Hedera EVM testnet
cp .env.hedera .env

# Start the server (reads from .env)
npm start
```

Alternatively, use the test scripts for automated switching:

```bash
bash test-proxy.sh zircuit   # Auto-switches to Zircuit and starts server
bash test-proxy.sh flow      # Auto-switches to Flow and starts server
bash test-proxy.sh hedera    # Auto-switches to Hedera and starts server
```

### Security Configuration

**Development vs Production:**

- **Development**: All `.env.*` files use the test mnemonic `test test test...junk` (safe, no real funds)
- **Production**: Copy `.env.sample` to `.env`, replace `SIGNING_MNEMONIC` with your actual 12-word phrase

⚠️ **Never commit your real mnemonic to version control!**

### Network-Specific Configurations

### Network-Specific Configurations

The proxy supports three testnets with correct RPC endpoints:

- **Zircuit Garfield Testnet** (`.env.zircuit`): 
  - Port: 3001
  - RPC: `https://garfield-testnet.zircuit.com/`
  - Chain ID: 48898
  
- **Flow EVM Testnet** (`.env.flow`): 
  - Port: 3002
  - RPC: `https://testnet.evm.nodes.onflow.org/`
  - Chain ID: 545
  
- **Hedera EVM Testnet** (`.env.hedera`): 
  - Port: 3003
  - RPC: `https://testnet.hashio.io/api`
  - Chain ID: 296

### Environment Variables

Key configuration options:

```bash
# Network Selection
NETWORK=zircuit|flow|hedera

# RPC Configuration (network-specific)
ZIRCUIT_RPC_URL=https://garfield-testnet.zircuit.com/
FLOW_RPC_URL=https://testnet.evm.nodes.onflow.org/
HEDERA_RPC_URL=https://testnet.hashio.io/api

# Signing Configuration
SIGNING_MNEMONIC=your twelve word mnemonic phrase here
# OR
PRIVATE_KEY=your_private_key_here

# Server Configuration
PORT=3001
LOG_LEVEL=info
```

## API Endpoints

### Core Endpoints

- **GET** `/health` - Health check and system status
- **GET** `/network` - Network information and signer address
- **GET** `/block/current` - Current block number

### Transaction Operations

- **POST** `/tx/broadcast` - Broadcast transaction and start tracking
- **GET** `/tx/:txHash` - Get transaction status and timing data
- **GET** `/tx/:txHash/proof` - Generate signed delay proof for confirmed transactions

### Insurance Integration

- **POST** `/insurance/claim` - Submit insurance claim (proxy to contract)

### Monitoring & Statistics

- **GET** `/stats` - Cache and network statistics
- **GET** `/transactions` - List cached transactions (with optional filters)

## Usage Examples

### 1. Broadcast a Transaction

```bash
curl -X POST http://localhost:3001/tx/broadcast \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x742d35Cc6634C0532925a3b8C1c5",
    "value": "1000000000000000000",
    "gasLimit": "21000"
  }'
```

Response:
```json
{
  "txHash": "0xabc123...",
  "broadcastBlock": 12345,
  "timestamp": 1691234567890,
  "status": "broadcast"
}
```

### 2. Check Transaction Status

```bash
curl http://localhost:3001/tx/0xabc123...
```

Response:
```json
{
  "txHash": "0xabc123...",
  "broadcastBlock": 12345,
  "confirmationBlock": 12355,
  "delay": 10,
  "status": "confirmed",
  "broadcastTimestamp": 1691234567890,
  "confirmationTimestamp": 1691234567890
}
```

### 3. Get Delay Proof

```bash
curl http://localhost:3001/tx/0xabc123.../proof
```

Response:
```json
{
  "txHash": "0xabc123...",
  "broadcastBlock": 12345,
  "confirmationBlock": 12355,
  "signature": "0x1234abcd...",
  "signer": "0x742d35Cc...",
  "delay": 10,
  "timestamp": 1691234567890
}
```

## Testing

### Quick Network Testing

Test individual networks using the automated scripts:
```bash
bash test-proxy.sh zircuit   # Test Zircuit Garfield testnet
bash test-proxy.sh flow      # Test Flow EVM testnet
bash test-proxy.sh hedera    # Test Hedera EVM testnet
```

Test all networks automatically:
```bash
./test-all-networks.sh      # Comprehensive test of all three networks
```

### Manual Testing

Start server with a specific network:
```bash
# Switch to desired network
cp .env.zircuit .env
npm start

# In another terminal, test endpoints
curl http://localhost:3001/health
curl http://localhost:3001/network
curl http://localhost:3001/block/current
```

### Unit Tests

Run the test suite:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Architecture

### Components

1. **BlockchainService**: Handles all blockchain interactions using ethers.js
2. **TransactionCache**: In-memory cache for transaction timing data
3. **RPCProxyServer**: Express.js server with middleware and routing
4. **Logger**: Winston-based structured logging

### Transaction Flow

1. Client broadcasts transaction via `/tx/broadcast`
2. Proxy records current block number before broadcasting
3. Proxy broadcasts transaction to the actual RPC
4. Proxy monitors transaction for confirmation
5. Upon confirmation, proxy records confirmation block
6. Delay proof can be generated via `/tx/:hash/proof`

### Security

- Rate limiting prevents abuse
- CORS protection for web clients
- Helmet middleware for security headers
- Input validation with Joi
- Signed delay proofs for authenticity

## Network-Specific Details

### Zircuit Garfield Testnet
- Chain ID: 48898
- Known for AI-based transaction quarantining
- May have higher delay variability

### Flow EVM Testnet  
- Chain ID: 545
- Flow blockchain's EVM-compatible layer
- Generally fast confirmation times

### Hedera EVM Testnet
- Chain ID: 296
- Enterprise-grade network
- Predictable confirmation times

## Troubleshooting

### Common Issues

1. **Connection failures**: Check RPC URL and network connectivity
2. **Signing errors**: Verify mnemonic/private key configuration
3. **Rate limiting**: Reduce request frequency or adjust limits
4. **Memory usage**: Monitor cache size and adjust cleanup intervals

### Logs

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output (in development)

### Health Monitoring

Check server health:
```bash
curl http://localhost:3001/health
```

Get detailed statistics:
```bash
curl http://localhost:3001/stats
```

## Development

### Project Structure

```
rpc/
├── src/
│   ├── server.js      # Main entry point
│   ├── proxy.js       # Express server and routing
│   ├── blockchain.js  # Blockchain service with ethers.js
│   ├── cache.js       # Transaction cache management
│   ├── config.js      # Configuration and validation
│   └── logger.js      # Winston logging setup
├── tests/             # Test files
├── logs/              # Log files
├── .env.*            # Environment configurations
└── package.json      # Dependencies and scripts
```

### Adding New Networks

1. Add network configuration to `config.js`
2. Create new `.env.{network}` file
3. Update documentation and examples

## License

BUSL-1.1 - See LICENSE file for details.
