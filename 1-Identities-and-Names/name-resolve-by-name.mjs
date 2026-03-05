// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/retrieve-a-name.html
import { setupDashClient } from '../setupDashClient.mjs';

const { sdk } = await setupDashClient();

const NAME = 'quantumexplorer.dash';

try {
  // Resolve by full name (e.g., myname.dash)
  const result = await sdk.dpns.resolveName(NAME);
  console.log(`Identity ID for "${NAME}": ${result}`);
} catch (e) {
  console.error('Something went wrong:\n', e.message);
}