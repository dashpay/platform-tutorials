export interface RatedResource {
  id: string;
  title: string;
  category: "Tutorial" | "Example App" | "Reference";
  summary: string;
  href: string;
}

export const RESOURCES: RatedResource[] = [
  {
    id: "intro",
    title: "Platform Introduction",
    category: "Tutorial",
    summary: "The starting point for connecting to Dash Platform testnet.",
    href: "https://docs.dash.org/projects/platform/en/stable/docs/tutorials/introduction.html",
  },
  {
    id: "identities-names",
    title: "Identities and Names",
    category: "Tutorial",
    summary: "Create identities, fund them, and register DPNS names.",
    href: "https://docs.dash.org/projects/platform/en/stable/docs/tutorials/identities-and-names.html",
  },
  {
    id: "contracts-documents",
    title: "Contracts and Documents",
    category: "Tutorial",
    summary:
      "Register contracts and submit, query, update, and delete documents.",
    href: "https://docs.dash.org/projects/platform/en/stable/docs/tutorials/contracts-and-documents.html",
  },
  {
    id: "tokens",
    title: "Tokens",
    category: "Tutorial",
    summary: "Register, mint, transfer, and burn Platform tokens.",
    href: "https://docs.dash.org/projects/platform/en/stable/docs/tutorials/tokens.html",
  },
  {
    id: "dashnote",
    title: "Dashnote",
    category: "Example App",
    summary: "A notes app that demonstrates mutable documents and history.",
    href: "../dashnote/",
  },
  {
    id: "dashmint-lab",
    title: "DashMint Lab",
    category: "Example App",
    summary: "NFT-style collectible documents with token-gated creation.",
    href: "../dashmint-lab/",
  },
  {
    id: "dashproof-lab",
    title: "DashProof Lab",
    category: "Example App",
    summary: "Proof-of-existence anchoring and verification on Platform.",
    href: "../dashproof-lab/",
  },
];

export function findResource(resourceId: string): RatedResource | undefined {
  return RESOURCES.find((resource) => resource.id === resourceId);
}
