import type { MetadataInput } from "./registryWrites";

export interface SystemContractMetadata {
  contractId: string;
  input: MetadataInput;
}

const DASH_ICON_URL = "https://www.dash.org/favicon.ico";
const PLATFORM_SOURCE_URL = "https://github.com/dashpay/platform";

/** Curated entries installed into every newly published Dashapps registry. */
export const SYSTEM_CONTRACT_METADATA: readonly SystemContractMetadata[] = [
  {
    contractId: "7CSFGeF4WNzgDmx94zwvHkYaG3Dx4XEe5LFsFgJswLbm",
    input: {
      name: "WalletUtils",
      tagline: "Shared wallet encryption and account utilities",
      category: "wallets-payments",
      tags: "wallet,utilities,system-contract",
      appUrl: "",
      iconUrl: "",
      description:
        "Built-in Dash Platform contract providing shared document types used by wallet applications.",
      website: "",
      repository: PLATFORM_SOURCE_URL,
      docs: "",
    },
  },
  {
    contractId: "Bwr4WHCPz5rFVAD87RqTs3izo4zpzwsEdKPWUT1NS1C7",
    input: {
      name: "DashPay",
      tagline: "Dash Platform profiles and social payment contacts",
      category: "social",
      tags: "payments,profiles,contacts,system-contract",
      appUrl: "https://www.dash.org/dashpay/",
      iconUrl: "",
      description:
        "Built-in Dash Platform contract for user profiles, contact requests, and social payment features.",
      website: "https://www.dash.org/dashpay/",
      repository: PLATFORM_SOURCE_URL,
      docs: "",
    },
  },
  {
    contractId: "GWRSAVFMjXx8HpQFaNJMqBV7MBgMK4br5UESsB4S31Ec",
    input: {
      name: "DPNS",
      tagline: "Human-readable names for Dash Platform identities",
      category: "identity",
      tags: "names,identity,domains,system-contract",
      appUrl: "",
      iconUrl: DASH_ICON_URL,
      description:
        "Dash Platform Name Service maps human-readable .dash names to Platform identities.",
      website: "https://www.dash.org/platform/",
      repository: PLATFORM_SOURCE_URL,
      docs: "https://docs.dash.org/projects/platform/en/stable/docs/tutorials/register-a-name.html",
    },
  },
  {
    contractId: "rUnsWrFu3PKyRMGk2mxmZVBPbQuZx2qtHeFjURoQevX",
    input: {
      name: "Masternode Rewards",
      tagline: "Platform reward shares for masternodes",
      category: "finance",
      tags: "rewards,masternodes,system-contract",
      appUrl: "",
      iconUrl: DASH_ICON_URL,
      description:
        "Built-in Dash Platform contract that records how masternode Platform rewards are shared.",
      website: "https://www.dash.org/platform/",
      repository: PLATFORM_SOURCE_URL,
      docs: "https://docs.dash.org/projects/platform/en/stable/",
    },
  },
  {
    contractId: "4fJLR2GYTPFdomuTVvNy3VRrvWgvkKPzqehEBpNf2nk6",
    input: {
      name: "Withdrawals",
      tagline: "Withdraw Platform credits to Dash addresses",
      category: "wallets-payments",
      tags: "withdrawals,credits,payments,system-contract",
      appUrl: "",
      iconUrl: DASH_ICON_URL,
      description:
        "Built-in Dash Platform contract supporting withdrawals of Platform credits to Dash addresses.",
      website: "https://www.dash.org/platform/",
      repository: PLATFORM_SOURCE_URL,
      docs: "https://docs.dash.org/projects/platform/en/stable/",
    },
  },
];
