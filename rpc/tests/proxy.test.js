const request = require('supertest');
const RPCProxyServer = require('../src/proxy');

describe('RPC Proxy Server', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.NETWORK = 'zircuit';
    process.env.ZIRCUIT_RPC_URL = 'https://zircuit1-testnet.p2pify.com/';
    process.env.ZIRCUIT_CHAIN_ID = '48899';
    process.env.ZIRCUIT_NETWORK_NAME = 'Zircuit Testnet';
    process.env.SIGNING_MNEMONIC = 'test test test test test test test test test test test junk';
    process.env.LOG_LEVEL = 'error';

    server = new RPCProxyServer();
    await server.initialize();
    app = server.app;
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('Health Endpoints', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('network');
    });

    test('GET /network should return network info', async () => {
      const response = await request(app)
        .get('/network')
        .expect(200);

      expect(response.body).toHaveProperty('name', 'Zircuit Testnet');
      expect(response.body).toHaveProperty('chainId', 48899);
      expect(response.body).toHaveProperty('signerAddress');
    });

    test('GET /stats should return statistics', async () => {
      const response = await request(app)
        .get('/stats')
        .expect(200);

      expect(response.body).toHaveProperty('cache');
      expect(response.body).toHaveProperty('network');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('Block Endpoints', () => {
    test('GET /block/current should return current block', async () => {
      const response = await request(app)
        .get('/block/current')
        .expect(200);

      expect(response.body).toHaveProperty('blockNumber');
      expect(response.body).toHaveProperty('timestamp');
      expect(typeof response.body.blockNumber).toBe('number');
    });
  });

  describe('Transaction Endpoints', () => {
    test('POST /tx/broadcast should validate required fields', async () => {
      const response = await request(app)
        .post('/tx/broadcast')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Missing required field: to');
    });

    test('GET /tx/:txHash should handle non-existent transaction', async () => {
      const response = await request(app)
        .get('/tx/0x1234567890abcdef1234567890abcdef12345678')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Transaction not found');
    });

    test('GET /transactions should return transaction list', async () => {
      const response = await request(app)
        .get('/transactions')
        .expect(200);

      expect(response.body).toHaveProperty('transactions');
      expect(response.body).toHaveProperty('count');
      expect(Array.isArray(response.body.transactions)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Endpoint not found');
    });
  });
});
