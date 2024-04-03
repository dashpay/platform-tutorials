// See https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names/register-a-name-for-an-identity.html
const setupDashClient = require('../setupDashClient');

const client = setupDashClient();

const registerAlias = async () => {
  const platform = client.platform;
  const identity = await platform.identities.get(process.env.IDENTITY_ID); // Your identity ID
  const aliasRegistration = await platform.names.register(
    `${aliasToRegister}.dash`,
    { dashAliasIdentityId: identity.getId() },
    identity,
  );

  return aliasRegistration;
};

registerAlias()
  .then((d) => console.log('Alias registered:\n', d.toJSON()))
  .catch((e) => console.error('Something went wrong:\n', e))
  .finally(() => client.disconnect());
