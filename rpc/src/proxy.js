const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const axios = require('axios');

const config = require('./config');
const createLogger = require('./logger');
const BlockchainService = require('./blockchain');
const TransactionCache = require('./cache');

class RPCProxyServer {
  constructor() {
    this.app = express();
    this.logger = createLogger(config.logLevel);
    this.blockchainService = null;
    this.transactionCache = null;
  this.httpServer = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  async initialize() {
    try {
      // Initialize blockchain service
      this.blockchainService = new BlockchainService(config);
      
      // Initialize transaction cache
      this.transactionCache = new TransactionCache(config);
      
      this.logger.info('RPC Proxy server initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize RPC Proxy server:', error);
      throw error;
    }
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet());
    this.app.use(compression());
    
    // CORS
    this.app.use(cors({
      origin: config.corsOrigin === '*' ? true : config.corsOrigin,
      credentials: true
    }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: config.rateLimit.windowMs,
      max: config.rateLimit.maxRequests,
      message: {
        error: 'Too many requests from this IP, please try again later'
      }
    });
    this.app.use(limiter);
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  setupRoutes() {
    // JSON-RPC root handler (wallets expect POST /)
    this.app.post('/', async (req, res) => {
      const chainIdHex = '0x' + Number(config.currentNetwork.chainId).toString(16);

      const handleSingle = async (payload) => {
        try {
          if (!payload || typeof payload !== 'object') {
            return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
          }

          const { id, method, params } = payload;

          // Serve chain identity locally for reliability
          if (method === 'eth_chainId') {
            return { jsonrpc: '2.0', id, result: chainIdHex };
          }
          if (method === 'net_version') {
            return { jsonrpc: '2.0', id, result: String(Number(config.currentNetwork.chainId)) };
          }

          // Intercept transaction broadcasting to create delay proofs
          if (method === 'eth_sendRawTransaction') {
            return await this.handleTransactionBroadcast(payload);
          }

          // Forward other RPC methods to the upstream node
          const upstream = await axios.post(
            config.currentNetwork.rpcUrl,
            payload,
            { headers: { 'content-type': 'application/json' } }
          );
          return upstream.data;
        } catch (err) {
          // Normalize error to JSON-RPC format
          return {
            jsonrpc: '2.0',
            id: payload?.id ?? null,
            error: {
              code: -32603,
              message: 'Upstream RPC error',
              data: err?.response?.data || err?.message || String(err)
            }
          };
        }
      };

      try {
        const body = req.body;
        if (Array.isArray(body)) {
          const results = await Promise.all(body.map(handleSingle));
          return res.json(results);
        }
        const result = await handleSingle(body);
        return res.json(result);
      } catch (error) {
        this.logger.error('Failed to process JSON-RPC request:', error);
        return res.status(500).json({
          jsonrpc: '2.0',
          id: null,
          error: { code: -32603, message: 'Internal error' }
        });
      }
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        network: this.blockchainService?.getNetworkInfo() || 'not initialized',
        cacheStats: this.transactionCache?.getStats() || 'not initialized'
      });
    });

    // Network info
    this.app.get('/network', (req, res) => {
      try {
        const networkInfo = this.blockchainService.getNetworkInfo();
        res.json(networkInfo);
      } catch (error) {
        this.logger.error('Failed to get network info:', error);
        res.status(500).json({ error: 'Failed to get network info' });
      }
    });

    // Get current block number
    this.app.get('/block/current', async (req, res) => {
      try {
        const blockNumber = await this.blockchainService.getCurrentBlockNumber();
        res.json({ blockNumber, timestamp: Date.now() });
      } catch (error) {
        this.logger.error('Failed to get current block number:', error);
        res.status(500).json({ error: 'Failed to get current block number' });
      }
    });

    // Broadcast transaction
    this.app.post('/tx/broadcast', async (req, res) => {
      try {
        const { to, value, data, gasLimit, gasPrice, maxFeePerGas, maxPriorityFeePerGas } = req.body;
        
        // Validate required fields
        if (!to) {
          return res.status(400).json({ error: 'Missing required field: to' });
        }

        // Get current block number before broadcasting
        const broadcastBlock = await this.blockchainService.getCurrentBlockNumber();
        const timestamp = Date.now();

        // Prepare transaction
        const txRequest = {
          to,
          value: value || '0',
          data: data || '0x',
          gasLimit: gasLimit || 21000
        };

        // Add gas pricing (EIP-1559 or legacy)
        if (maxFeePerGas && maxPriorityFeePerGas) {
          txRequest.maxFeePerGas = maxFeePerGas;
          txRequest.maxPriorityFeePerGas = maxPriorityFeePerGas;
        } else if (gasPrice) {
          txRequest.gasPrice = gasPrice;
        }

        // Broadcast transaction
        const tx = await this.blockchainService.sendTransaction(txRequest);
        
        // Store broadcast info in cache
        this.transactionCache.storeBroadcast(tx.hash, broadcastBlock, timestamp);

        // Start monitoring for confirmation
        this.monitorTransaction(tx.hash);

        res.json({
          txHash: tx.hash,
          broadcastBlock,
          timestamp,
          status: 'broadcast'
        });

      } catch (error) {
        this.logger.error('Failed to broadcast transaction:', error);
        res.status(500).json({ 
          error: 'Failed to broadcast transaction',
          details: error.message 
        });
      }
    });

    // Get transaction status
    this.app.get('/tx/:txHash', async (req, res) => {
      try {
        const { txHash } = req.params;
        
        // Get from cache first
        let cachedData = this.transactionCache.getTransaction(txHash);
        
        // If not in cache or not confirmed, try to get from blockchain
        if (!cachedData || cachedData.status === 'broadcast') {
          let receipt = null;
          try {
            receipt = await this.blockchainService.getTransactionReceipt(txHash);
          } catch (err) {
            // Treat invalid or unknown hashes as not found rather than 500
            const msg = (err && err.message) ? err.message : String(err);
            this.logger.warn(`Receipt lookup failed for ${txHash}: ${msg}`);
          }
          if (receipt) {
            const confirmationBlock = receipt.blockNumber;
            cachedData = this.transactionCache.storeConfirmation(
              txHash, 
              confirmationBlock, 
              receipt,
              Date.now()
            );
          }
        }

        if (!cachedData) {
          return res.status(404).json({ error: 'Transaction not found' });
        }

        res.json(cachedData);

      } catch (error) {
        this.logger.error(`Failed to get transaction ${req.params.txHash}:`, error);
        res.status(500).json({ 
          error: 'Failed to get transaction',
          details: error.message 
        });
      }
    });

    // Get delay proof for a transaction
    this.app.get('/tx/:txHash/proof', async (req, res) => {
      try {
        const { txHash } = req.params;
        
        const cachedData = this.transactionCache.getTransaction(txHash);
        
        if (!cachedData) {
          return res.status(404).json({ error: 'Transaction not found in cache' });
        }

        if (cachedData.status !== 'confirmed') {
          return res.status(400).json({ 
            error: 'Transaction not confirmed yet',
            status: cachedData.status 
          });
        }

        if (!cachedData.broadcastBlock || !cachedData.confirmationBlock) {
          return res.status(400).json({ 
            error: 'Incomplete transaction data for proof generation' 
          });
        }

        // Generate signed delay proof
        const proof = await this.blockchainService.signDelayProof(
          txHash,
          cachedData.broadcastBlock,
          cachedData.confirmationBlock
        );

        res.json({
          ...proof,
          delay: cachedData.delay,
          broadcastTimestamp: cachedData.broadcastTimestamp,
          confirmationTimestamp: cachedData.confirmationTimestamp
        });

      } catch (error) {
        this.logger.error(`Failed to generate proof for ${req.params.txHash}:`, error);
        res.status(500).json({ 
          error: 'Failed to generate delay proof',
          details: error.message 
        });
      }
    });

    // Submit insurance claim (proxy call to contract)
    this.app.post('/insurance/claim', async (req, res) => {
      try {
        const { contractAddress, policyId, proof } = req.body;
        
        if (!contractAddress || !proof) {
          return res.status(400).json({ 
            error: 'Missing required fields: contractAddress, proof' 
          });
        }

        // Verify the proof signature locally first
        const isValidProof = await this.blockchainService.verifyDelayProof(proof);
        if (!isValidProof) {
          return res.status(400).json({ error: 'Invalid delay proof signature' });
        }

        // TODO: Implement contract interaction to submit claim
        // For now, just return success response
        res.json({
          status: 'submitted',
          message: 'Claim submitted successfully',
          timestamp: Date.now()
        });

      } catch (error) {
        this.logger.error('Failed to submit insurance claim:', error);
        res.status(500).json({ 
          error: 'Failed to submit insurance claim',
          details: error.message 
        });
      }
    });

    // Get cache statistics
    this.app.get('/stats', (req, res) => {
      try {
        const stats = this.transactionCache.getStats();
        const networkInfo = this.blockchainService.getNetworkInfo();
        
        res.json({
          cache: stats,
          network: networkInfo,
          uptime: process.uptime(),
          timestamp: Date.now()
        });
      } catch (error) {
        this.logger.error('Failed to get stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // Get all cached transactions
    this.app.get('/transactions', (req, res) => {
      try {
        const { status, limit = 100 } = req.query;
        
        let transactions;
        if (status) {
          transactions = this.transactionCache.getTransactionsByStatus(status);
        } else {
          transactions = this.transactionCache.getAllTransactions();
        }
        
        // Apply limit
        if (limit) {
          transactions = transactions.slice(0, parseInt(limit));
        }
        
        res.json({
          transactions,
          count: transactions.length,
          timestamp: Date.now()
        });
      } catch (error) {
        this.logger.error('Failed to get transactions:', error);
        res.status(500).json({ error: 'Failed to get transactions' });
      }
    });
  }

  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ 
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Global error handler
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled error:', error);
      
      res.status(500).json({
        error: 'Internal server error',
        message: config.nodeEnv === 'development' ? error.message : 'Something went wrong'
      });
    });
  }

  // Handle RPC transaction broadcast interception
  async handleTransactionBroadcast(payload) {
    try {
      const { id, params } = payload;
      const [rawTx] = params;

      if (!rawTx) {
        return {
          jsonrpc: '2.0',
          id,
          error: { code: -32602, message: 'Invalid params: missing raw transaction' }
        };
      }

      // Record broadcast timestamp and block number
      const timestamp = Date.now();
      const broadcastBlock = await this.blockchainService?.getCurrentBlockNumber();

      this.logger.info('Intercepting transaction broadcast', {
        timestamp,
        broadcastBlock,
        rawTxLength: rawTx.length
      });

      // Forward to upstream RPC
      const upstream = await axios.post(
        config.currentNetwork.rpcUrl,
        payload,
        { headers: { 'content-type': 'application/json' } }
      );

      // If successful, store transaction for monitoring
      if (upstream.data?.result) {
        const txHash = upstream.data.result;
        
        // Store broadcast information
        this.transactionCache?.storeBroadcast(txHash, broadcastBlock, timestamp);
        
        // Start monitoring this transaction in the background
        this.monitorTransactionInBackground(txHash).catch(err => {
          this.logger.error('Background transaction monitoring failed', {
            txHash,
            error: err.message
          });
        });

        this.logger.info('Transaction broadcast intercepted and forwarded', {
          txHash,
          broadcastBlock,
          timestamp
        });
      }

      // Return the upstream response transparently
      return upstream.data;

    } catch (err) {
      this.logger.error('Transaction broadcast interception failed', {
        error: err.message,
        payload: payload
      });

      // Return upstream error or generic error
      return {
        jsonrpc: '2.0',
        id: payload?.id ?? null,
        error: {
          code: -32603,
          message: 'Transaction broadcast failed',
          data: err?.response?.data || err?.message || String(err)
        }
      };
    }
  }

  // Monitor transaction confirmation and create delay proof automatically
  async monitorTransactionInBackground(txHash) {
    const maxRetries = 60; // Monitor for up to 10 minutes (60 * 10s intervals)
    let retries = 0;

    const monitor = async () => {
      try {
        const receipt = await this.blockchainService?.getTransactionReceipt(txHash);
        
        if (receipt) {
          // Transaction confirmed
          const confirmationBlock = receipt.blockNumber;
          this.transactionCache?.storeConfirmation(txHash, confirmationBlock, receipt);

          // Create delay proof automatically
          const cachedData = this.transactionCache?.getTransaction(txHash);
          if (cachedData?.broadcastBlock && confirmationBlock) {
            const delayBlocks = confirmationBlock - cachedData.broadcastBlock;
            
            // Create and store the delay proof
            const proof = await this.blockchainService?.signDelayProof(
              txHash,
              cachedData.broadcastBlock,
              confirmationBlock
            );

            this.logger.info('Automatic delay proof created', {
              txHash,
              delayBlocks,
              broadcastBlock: cachedData.broadcastBlock,
              confirmationBlock,
              proofCreated: !!proof
            });
          }

          return; // Monitoring complete
        }

        // Not confirmed yet, continue monitoring
        retries++;
        if (retries < maxRetries) {
          setTimeout(monitor, 10000); // Check again in 10 seconds
        } else {
          this.logger.warn('Transaction monitoring timeout', {
            txHash,
            maxRetries
          });
        }

      } catch (err) {
        this.logger.error('Transaction monitoring error', {
          txHash,
          error: err.message,
          retries
        });

        // Store failure information
        this.transactionCache?.storeFailure(txHash, err.message);
      }
    };

    // Start monitoring
    monitor();
  }

  async monitorTransaction(txHash) {
    const maxAttempts = 60; // Monitor for up to 5 minutes (60 * 5s)
    let attempts = 0;

    const monitor = async () => {
      try {
        attempts++;
        
        const receipt = await this.blockchainService.getTransactionReceipt(txHash);
        
        if (receipt) {
          // Transaction confirmed
          const confirmationBlock = receipt.blockNumber;
          this.transactionCache.storeConfirmation(txHash, confirmationBlock, receipt);
          this.logger.info(`Transaction ${txHash} confirmed at block ${confirmationBlock}`);
          return;
        }
        
        if (attempts < maxAttempts) {
          // Continue monitoring
          setTimeout(monitor, 5000); // Check every 5 seconds
        } else {
          // Monitoring timeout
          this.logger.warn(`Monitoring timeout for transaction ${txHash}`);
        }
        
      } catch (error) {
        if (attempts < maxAttempts) {
          setTimeout(monitor, 5000);
        } else {
          this.transactionCache.storeFailure(txHash, error);
          this.logger.error(`Failed to monitor transaction ${txHash}:`, error);
        }
      }
    };

    // Start monitoring after a short delay
    setTimeout(monitor, 1000);
  }

  async start() {
    try {
      await this.initialize();
      
      this.httpServer = this.app.listen(config.port, () => {
        this.logger.info(`RPC Proxy server running on port ${config.port}`);
        this.logger.info(`Network: ${config.currentNetwork.networkName}`);
        this.logger.info(`Environment: ${config.nodeEnv}`);
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      if (this.transactionCache && typeof this.transactionCache.stopCleanupInterval === 'function') {
        this.transactionCache.stopCleanupInterval();
      }
      if (this.httpServer && typeof this.httpServer.close === 'function') {
        await new Promise((resolve) => this.httpServer.close(resolve));
        this.httpServer = null;
      }
    } catch (error) {
      this.logger.error('Error during RPCProxyServer stop():', error);
    }
  }
}

module.exports = RPCProxyServer;
