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
# Copy and edit configuration for your preferred network
cp .env.zircuit .env
# OR
cp .env.flow .env
# OR
cp .env.hedera .env

# Edit .env with your actual values
nano .env
```

3. **Start the server**:
```bash
npm start
# OR for development with auto-reload
npm run dev
```

## Configuration

### Network-Specific Configurations

The proxy supports three testnets with pre-configured settings:

- **Zircuit Testnet** (`.env.zircuit`): Port 3001
- **Flow EVM Testnet** (`.env.flow`): Port 3002  
- **Hedera EVM Testnet** (`.env.hedera`): Port 3003

### Environment Variables

Key configuration options:

```bash
# Network Selection
NETWORK=zircuit|flow|hedera

# RPC Configuration (network-specific)
ZIRCUIT_RPC_URL=https://zircuit1-testnet.p2pify.com/
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

### Zircuit Testnet
- Chain ID: 48899
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
