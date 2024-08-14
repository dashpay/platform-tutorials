// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-a-name-for-an-identity.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const registerName = async () => {
  const { platform } = client;

  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const nameRegistration = await platform.names.register(
    `${nameToRegister}.dash`,
    { identity: identity.getId() },
    identity,
  );

  return nameRegistration;
};

registerName()
  .then((d) => console.log('Name registered:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
