const { ethers } = require('ethers');
const createLogger = require('./logger');

class BlockchainService {
  constructor(config) {
    this.config = config;
    this.logger = createLogger(config.logLevel);
    this.provider = null;
    this.signer = null;
    this.signerAddress = null;
    
    this.init();
  }

  async init() {
    try {
      // Initialize provider
      this.provider = new ethers.JsonRpcProvider(this.config.currentNetwork.rpcUrl);
      
      // Initialize signer
      if (this.config.signing.privateKey) {
        this.signer = new ethers.Wallet(this.config.signing.privateKey, this.provider);
      } else if (this.config.signing.mnemonic) {
        const wallet = ethers.Wallet.fromPhrase(this.config.signing.mnemonic);
        this.signer = wallet.connect(this.provider);
      } else {
        throw new Error('No signing method configured');
      }
      
      this.signerAddress = await this.signer.getAddress();
      this.logger.info(`Blockchain service initialized for ${this.config.currentNetwork.networkName}`);
      this.logger.info(`Signer address: ${this.signerAddress}`);
      
      // Test connection
      await this.testConnection();
      
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      const network = await this.provider.getNetwork();
      
      this.logger.info(`Connected to ${this.config.currentNetwork.networkName}`);
      this.logger.info(`Current block number: ${blockNumber}`);
      this.logger.info(`Chain ID: ${network.chainId}`);
      
      return { blockNumber, chainId: network.chainId };
    } catch (error) {
      this.logger.error('Connection test failed:', error);
      throw error;
    }
  }

  async getCurrentBlockNumber() {
    try {
      const blockNumber = await this.provider.getBlockNumber();
      this.logger.debug(`Current block number: ${blockNumber}`);
      return blockNumber;
    } catch (error) {
      this.logger.error('Failed to get block number:', error);
      throw error;
    }
  }

  async getBlock(blockNumberOrHash) {
    try {
      const block = await this.provider.getBlock(blockNumberOrHash);
      return block;
    } catch (error) {
      this.logger.error(`Failed to get block ${blockNumberOrHash}:`, error);
      throw error;
    }
  }

  async getTransaction(txHash) {
    try {
      const tx = await this.provider.getTransaction(txHash);
      return tx;
    } catch (error) {
      this.logger.error(`Failed to get transaction ${txHash}:`, error);
      throw error;
    }
  }

  async getTransactionReceipt(txHash) {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      return receipt;
    } catch (error) {
      this.logger.error(`Failed to get transaction receipt ${txHash}:`, error);
      throw error;
    }
  }

  async sendTransaction(transactionRequest) {
    try {
      this.logger.info('Broadcasting transaction:', {
        to: transactionRequest.to,
        value: transactionRequest.value,
        gasLimit: transactionRequest.gasLimit
      });
      
      const tx = await this.signer.sendTransaction(transactionRequest);
      this.logger.info(`Transaction broadcast with hash: ${tx.hash}`);
      
      return tx;
    } catch (error) {
      this.logger.error('Failed to send transaction:', error);
      throw error;
    }
  }

  async signMessage(message) {
    try {
      const signature = await this.signer.signMessage(message);
      this.logger.debug('Message signed successfully');
      return signature;
    } catch (error) {
      this.logger.error('Failed to sign message:', error);
      throw error;
    }
  }

  async signDelayProof(txHash, broadcastBlock, confirmationBlock) {
    try {
      // Create the message to sign
      const message = ethers.solidityPackedKeccak256(
        ['bytes32', 'uint256', 'uint256'],
        [txHash, broadcastBlock, confirmationBlock]
      );

      // Sign the message hash (this will automatically prefix with "\x19Ethereum Signed Message:\n32")
      const signature = await this.signer.signMessage(ethers.getBytes(message));
      
      this.logger.info(`Delay proof signed for tx ${txHash}`);
      this.logger.debug(`Broadcast block: ${broadcastBlock}, Confirmation block: ${confirmationBlock}`);
      
      return {
        txHash,
        broadcastBlock,
        confirmationBlock,
        signature,
        signer: this.signerAddress,
        messageHash: message,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to sign delay proof:', error);
      throw error;
    }
  }

  // Utility method to verify a signature
  async verifyDelayProof(proof) {
    try {
      const message = ethers.solidityPackedKeccak256(
        ['bytes32', 'uint256', 'uint256'],
        [proof.txHash, proof.broadcastBlock, proof.confirmationBlock]
      );

      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(message), proof.signature);
      const isValid = recoveredAddress.toLowerCase() === this.signerAddress.toLowerCase();
      
      this.logger.debug(`Signature verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (error) {
      this.logger.error('Failed to verify delay proof:', error);
      return false;
    }
  }

  getSignerAddress() {
    return this.signerAddress;
  }

  getNetworkInfo() {
    return {
      name: this.config.currentNetwork.networkName,
      chainId: this.config.currentNetwork.chainId,
      rpcUrl: this.config.currentNetwork.rpcUrl,
      signerAddress: this.signerAddress
    };
  }
}

module.exports = BlockchainService;
