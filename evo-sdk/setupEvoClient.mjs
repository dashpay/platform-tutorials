import { EvoSDK } from '@dashevo/evo-sdk';
import dotenv from 'dotenv';
dotenv.config();

// Build options from environment variables or defaults
const network = process.env.NETWORK || 'testnet';
const trusted = process.env.TRUSTED === 'true' || true; // Default to true for faster connection in tutorials

// Fully configured client options
const clientOptions = {
  // The network to connect to ('mainnet' or 'testnet')
  network,

  // Use trusted quorum mode
  // When true, uses pre-validated quorum information for faster connection
  // Set to false for production to maximize security
  trusted,

  // Custom list of DAPI addresses to connect to
  // Format: [ 'https://ip:port' }
  // When provided, network option is still required for protocol configuration
  // addresses: ['https://127.0.0.1:1443', 'https://192.168.1.100:1443'],

  // Specific platform protocol version to use
  // If not specified, uses the latest version
  // version: parseInt(process.env.PLATFORM_VERSION, 10),

  // Enable proof verification for all responses
  // Recommended for production applications
  // proofs: process.env.PROOFS === 'true',

  // Configure tracing/logging from underlying Wasm SDK
  // Simple levels: 'off' | 'error' | 'warn' | 'info' | 'debug' | 'trace'
  // Advanced EnvFilter syntax: 'wasm_sdk=debug,rs_dapi_client=warn,rs_sdk=info'
  logs: process.env.LOGS || 'warn',

  // settings: {
  //   // Timeout for establishing connection (milliseconds)
  //   connectTimeoutMs: parseInt(process.env.CONNECT_TIMEOUT_MS, 10) || 10000,

  //   // Timeout for individual requests (milliseconds)
  //   timeoutMs: parseInt(process.env.TIMEOUT_MS, 10) || 30000,

  //   // Number of times to retry failed requests
  //   retries: parseInt(process.env.RETRIES, 10) || 3,

  //   // Whether to ban addresses that fail to respond properly
  //   // Set to true in production to avoid bad nodes
  //   banFailedAddress: process.env.BAN_FAILED_ADDRESS === 'true' || false,
  // },
};

/**
 * Creates and returns a configured EvoSDK instance
 *
 * @param {Object} options - Configuration options
 * @returns {EvoSDK} Configured EvoSDK instance (not yet connected)
 */
function setupEvoClient(options = clientOptions) {
  // Validate and convert numeric options from environment variables
  if (options.version && typeof options.version === 'string') {
    options.version = parseInt(options.version, 10);
  }

  if (options.settings) {
    ['connectTimeoutMs', 'timeoutMs', 'retries'].forEach((key) => {
      if (options.settings[key] && typeof options.settings[key] === 'string') {
        options.settings[key] = parseInt(options.settings[key], 10);
      }
    });

    if (typeof options.settings.banFailedAddress === 'string') {
      options.settings.banFailedAddress =
        options.settings.banFailedAddress === 'true';
    }
  }

  // Use helper methods for easier setup
  if (options.network === 'testnet' && options.trusted) {
    return EvoSDK.testnetTrusted(options);
  } else if (options.network === 'mainnet') {
    return EvoSDK.mainnet(options);
  }

  return new EvoSDK(options);
}

export default setupEvoClient;
