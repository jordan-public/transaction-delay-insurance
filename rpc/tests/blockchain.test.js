const BlockchainService = require('../src/blockchain');

describe('BlockchainService', () => {
  let blockchainService;

  beforeAll(async () => {
    const config = {
      currentNetwork: {
  rpcUrl: 'https://garfield-testnet.zircuit.com/',
  chainId: 48898,
  networkName: 'Zircuit Garfield Testnet'
      },
      signing: {
        mnemonic: 'test test test test test test test test test test test junk',
        accountIndex: 0
      },
      logLevel: 'error'
    };

    blockchainService = new BlockchainService(config);
  });

  test('should initialize with correct signer address', () => {
    expect(blockchainService.getSignerAddress()).toBeDefined();
    expect(blockchainService.getSignerAddress()).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  test('should get current block number', async () => {
    const blockNumber = await blockchainService.getCurrentBlockNumber();
    expect(typeof blockNumber).toBe('number');
    expect(blockNumber).toBeGreaterThan(0);
  });

  test('should sign and verify delay proof', async () => {
    const txHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const broadcastBlock = 12345;
    const confirmationBlock = 12355;

    const proof = await blockchainService.signDelayProof(txHash, broadcastBlock, confirmationBlock);
    
    expect(proof).toHaveProperty('txHash', txHash);
    expect(proof).toHaveProperty('broadcastBlock', broadcastBlock);
    expect(proof).toHaveProperty('confirmationBlock', confirmationBlock);
    expect(proof).toHaveProperty('signature');
    expect(proof).toHaveProperty('signer');

    // Verify the proof
    const isValid = await blockchainService.verifyDelayProof(proof);
    expect(isValid).toBe(true);
  });

  test('should get network info', () => {
    const networkInfo = blockchainService.getNetworkInfo();
  expect(networkInfo).toHaveProperty('name', 'Zircuit Garfield Testnet');
  expect(networkInfo).toHaveProperty('chainId', 48898);
    expect(networkInfo).toHaveProperty('signerAddress');
  });
});
