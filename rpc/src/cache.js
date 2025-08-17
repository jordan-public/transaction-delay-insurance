const createLogger = require('./logger');

class TransactionCache {
  constructor(config) {
    this.config = config;
    this.logger = createLogger(config.logLevel);
    this.cache = new Map();
    this.cleanupInterval = null;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  startCleanupInterval() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.config.cache.cleanupIntervalMs);
    // Prevent keeping the event loop alive in tests and short-lived runs
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
    
    this.logger.info(`Transaction cache cleanup interval set to ${this.config.cache.cleanupIntervalMs}ms`);
  }

  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      this.logger.info('Stopped transaction cache cleanup interval');
    }
  }

  cleanup() {
    const now = Date.now();
    const beforeSize = this.cache.size;
    
    for (const [txHash, data] of this.cache.entries()) {
      if (now - data.timestamp > this.config.cache.maxAgeMs) {
        this.cache.delete(txHash);
      }
    }
    
    const afterSize = this.cache.size;
    if (beforeSize !== afterSize) {
      this.logger.info(`Cache cleanup: removed ${beforeSize - afterSize} expired entries`);
    }
  }

  storeBroadcast(txHash, broadcastBlock, timestamp = Date.now()) {
    const existing = this.cache.get(txHash);
    const data = {
      ...existing,
      txHash,
      broadcastBlock,
      broadcastTimestamp: timestamp,
      timestamp: existing ? existing.timestamp : timestamp,
      status: 'broadcast'
    };
    
    this.cache.set(txHash, data);
    this.logger.debug(`Stored broadcast data for tx ${txHash} at block ${broadcastBlock}`);
    
    return data;
  }

  storeConfirmation(txHash, confirmationBlock, receipt, timestamp = Date.now()) {
    const existing = this.cache.get(txHash);
    if (!existing) {
      this.logger.warn(`Confirmation received for unknown transaction: ${txHash}`);
      // Store confirmation even if we don't have broadcast data
    }
    
    const data = {
      ...existing,
      txHash,
      confirmationBlock,
      confirmationTimestamp: timestamp,
      receipt,
      status: 'confirmed',
      delay: existing && existing.broadcastBlock ? 
        confirmationBlock - existing.broadcastBlock : null
    };
    
    this.cache.set(txHash, data);
    this.logger.debug(`Stored confirmation data for tx ${txHash} at block ${confirmationBlock}`);
    
    if (data.delay !== null) {
      this.logger.info(`Transaction ${txHash} confirmed with ${data.delay} block delay`);
    }
    
    return data;
  }

  storeFailure(txHash, error, timestamp = Date.now()) {
    const existing = this.cache.get(txHash);
    const data = {
      ...existing,
      txHash,
      error: error.message || error,
      failureTimestamp: timestamp,
      status: 'failed'
    };
    
    this.cache.set(txHash, data);
    this.logger.debug(`Stored failure data for tx ${txHash}: ${error.message || error}`);
    
    return data;
  }

  getTransaction(txHash) {
    const data = this.cache.get(txHash);
    if (data) {
      this.logger.debug(`Retrieved cached data for tx ${txHash}`);
    } else {
      this.logger.debug(`No cached data found for tx ${txHash}`);
    }
    return data;
  }

  getAllTransactions() {
    return Array.from(this.cache.values());
  }

  getTransactionsByStatus(status) {
    return Array.from(this.cache.values()).filter(tx => tx.status === status);
  }

  getTransactionsWithDelay(minDelay = 1) {
    return Array.from(this.cache.values()).filter(tx => 
      tx.delay !== null && tx.delay >= minDelay
    );
  }

  deleteTransaction(txHash) {
    const deleted = this.cache.delete(txHash);
    if (deleted) {
      this.logger.debug(`Deleted cached data for tx ${txHash}`);
    }
    return deleted;
  }

  clear() {
    const size = this.cache.size;
    this.cache.clear();
    this.logger.info(`Cleared ${size} transactions from cache`);
  }

  getStats() {
    const transactions = Array.from(this.cache.values());
    const stats = {
      total: transactions.length,
      broadcast: transactions.filter(tx => tx.status === 'broadcast').length,
      confirmed: transactions.filter(tx => tx.status === 'confirmed').length,
      failed: transactions.filter(tx => tx.status === 'failed').length,
      withDelay: transactions.filter(tx => tx.delay && tx.delay > 0).length,
      averageDelay: 0,
      maxDelay: 0
    };
    
    const delayedTxs = transactions.filter(tx => tx.delay !== null && tx.delay >= 0);
    if (delayedTxs.length > 0) {
      stats.averageDelay = delayedTxs.reduce((sum, tx) => sum + tx.delay, 0) / delayedTxs.length;
      stats.maxDelay = Math.max(...delayedTxs.map(tx => tx.delay));
    }
    
    return stats;
  }
}

module.exports = TransactionCache;
