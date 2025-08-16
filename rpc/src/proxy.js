const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

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
          const receipt = await this.blockchainService.getTransactionReceipt(txHash);
          
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
      
      this.app.listen(config.port, () => {
        this.logger.info(`RPC Proxy server running on port ${config.port}`);
        this.logger.info(`Network: ${config.currentNetwork.networkName}`);
        this.logger.info(`Environment: ${config.nodeEnv}`);
      });
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

module.exports = RPCProxyServer;
