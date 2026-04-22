/**
 * Re-export of the browser-safe createClient() from setupDashClient-core.
 *
 * createClient(network) returns a connected EvoSDK instance. Nothing about
 * how we talk to the Dash Platform network is specific to this app —
 * createClient is the same entry point the Node tutorials use.
 *
 * SDK method: EvoSDK.testnetTrusted() / EvoSDK.mainnetTrusted() + sdk.connect()
 */
export { createClient } from '../../../../setupDashClient-core.mjs';
