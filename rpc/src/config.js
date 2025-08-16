require('dotenv').config();
const Joi = require('joi');

const configSchema = Joi.object({
  // Server Configuration
  PORT: Joi.number().default(3001),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  
  // Network Configuration
  NETWORK: Joi.string().valid('zircuit', 'flow', 'hedera').required(),
  
  // Network-specific RPC URLs
  ZIRCUIT_RPC_URL: Joi.string().uri().when('NETWORK', { is: 'zircuit', then: Joi.required() }),
  ZIRCUIT_CHAIN_ID: Joi.number().when('NETWORK', { is: 'zircuit', then: Joi.required() }),
  ZIRCUIT_NETWORK_NAME: Joi.string().when('NETWORK', { is: 'zircuit', then: Joi.required() }),
  
  FLOW_RPC_URL: Joi.string().uri().when('NETWORK', { is: 'flow', then: Joi.required() }),
  FLOW_CHAIN_ID: Joi.number().when('NETWORK', { is: 'flow', then: Joi.required() }),
  FLOW_NETWORK_NAME: Joi.string().when('NETWORK', { is: 'flow', then: Joi.required() }),
  
  HEDERA_RPC_URL: Joi.string().uri().when('NETWORK', { is: 'hedera', then: Joi.required() }),
  HEDERA_CHAIN_ID: Joi.number().when('NETWORK', { is: 'hedera', then: Joi.required() }),
  HEDERA_NETWORK_NAME: Joi.string().when('NETWORK', { is: 'hedera', then: Joi.required() }),
  
  // Signing Configuration
  SIGNING_MNEMONIC: Joi.string(),
  PRIVATE_KEY: Joi.string(),
  SIGNING_ACCOUNT_INDEX: Joi.number().default(0),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  
  // Logging
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  
  // CORS
  CORS_ORIGIN: Joi.string().default('*'),
  
  // Cache Configuration
  CACHE_CLEANUP_INTERVAL_MS: Joi.number().default(3600000),
  MAX_CACHE_AGE_MS: Joi.number().default(86400000)
}).unknown(true).or('SIGNING_MNEMONIC', 'PRIVATE_KEY'); // Allow unknown env vars

const { error, value: envVars } = configSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const getNetworkConfig = (network) => {
  const configs = {
    zircuit: {
      rpcUrl: envVars.ZIRCUIT_RPC_URL,
      chainId: envVars.ZIRCUIT_CHAIN_ID,
      networkName: envVars.ZIRCUIT_NETWORK_NAME
    },
    flow: {
      rpcUrl: envVars.FLOW_RPC_URL,
      chainId: envVars.FLOW_CHAIN_ID,
      networkName: envVars.FLOW_NETWORK_NAME
    },
    hedera: {
      rpcUrl: envVars.HEDERA_RPC_URL,
      chainId: envVars.HEDERA_CHAIN_ID,
      networkName: envVars.HEDERA_NETWORK_NAME
    }
  };
  
  return configs[network];
};

const currentNetwork = getNetworkConfig(envVars.NETWORK);

module.exports = {
  port: envVars.PORT,
  nodeEnv: envVars.NODE_ENV,
  network: envVars.NETWORK,
  currentNetwork,
  signing: {
    mnemonic: envVars.SIGNING_MNEMONIC,
    privateKey: envVars.PRIVATE_KEY,
    accountIndex: envVars.SIGNING_ACCOUNT_INDEX
  },
  rateLimit: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS
  },
  logLevel: envVars.LOG_LEVEL,
  corsOrigin: envVars.CORS_ORIGIN,
  cache: {
    cleanupIntervalMs: envVars.CACHE_CLEANUP_INTERVAL_MS,
    maxAgeMs: envVars.MAX_CACHE_AGE_MS
  }
};
