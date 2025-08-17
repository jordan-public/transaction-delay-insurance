const request = require('supertest');
const RPCProxyServer = require('../src/proxy');

describe('RPC Proxy Server', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.NETWORK = 'zircuit';
  process.env.ZIRCUIT_RPC_URL = 'https://garfield-testnet.zircuit.com/';
  process.env.ZIRCUIT_CHAIN_ID = '48898';
  process.env.ZIRCUIT_NETWORK_NAME = 'Zircuit Garfield Testnet';
    process.env.SIGNING_MNEMONIC = 'test test test test test test test test test test test junk';
    process.env.LOG_LEVEL = 'error';

    server = new RPCProxyServer();
    await server.initialize();
    app = server.app;
  });

  afterAll(async () => {
    if (server && typeof server.stop === 'function') {
      await server.stop();
    }
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

  expect(response.body).toHaveProperty('name', 'Zircuit Garfield Testnet');
  expect(response.body).toHaveProperty('chainId', 48898);
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

  describe('JSON-RPC root', () => {
    test('POST / with eth_chainId should return hex chain id', async () => {
      const response = await request(app)
        .post('/')
        .send({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] })
        .expect(200);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 1);
  // 48898 dec -> 0xbf02 hex
  expect(response.body).toHaveProperty('result', '0xbf02');
    });

    test('POST / with net_version should return decimal chain id as string', async () => {
      const response = await request(app)
        .post('/')
        .send({ jsonrpc: '2.0', id: 2, method: 'net_version', params: [] })
        .expect(200);

      expect(response.body).toHaveProperty('jsonrpc', '2.0');
      expect(response.body).toHaveProperty('id', 2);
  expect(response.body).toHaveProperty('result', '48898');
    });

    test('POST / supports batch requests', async () => {
      const payload = [
        { jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] },
        { jsonrpc: '2.0', id: 2, method: 'net_version', params: [] }
      ];
      const response = await request(app)
        .post('/')
        .send(payload)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      const byId = Object.fromEntries(response.body.map(r => [r.id, r]));
  expect(byId[1]).toHaveProperty('result', '0xbf02');
  expect(byId[2]).toHaveProperty('result', '48898');
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
