export interface ExampleFileFixture {
  id: string;
  label: string;
  filename: string;
  publicPath: string;
  chainId: string;
  sha256Hex: string;
  mimeType: string;
  note: string;
}

export const EXAMPLE_FILE_FIXTURES: ExampleFileFixture[] = [
  {
    id: "proof-fixture-01",
    label: "Proof Fixture 01",
    filename: "proof-fixture-01.txt",
    publicPath: "/example-files/proof-fixture-01.txt",
    chainId: "demo-proof-fixture-01",
    sha256Hex:
      "02e4e7cd6b6c73ec895e82d5e59065f30ffbb70f03fdd7d2a575ffd0c333d414",
    mimeType: "text/plain",
    note: "Plain-text demo file for first-run anchoring and later verify-by-hash.",
  },
  {
    id: "invoice-batch-2026-04",
    label: "Invoice Batch 2026-04",
    filename: "invoice-batch-2026-04.csv",
    publicPath: "/example-files/invoice-batch-2026-04.csv",
    chainId: "invoice-batch-2026-04",
    sha256Hex:
      "887569204f5265f2caf51c29f57703fe2c827df2c0d117c4f7287b06d7f3efe8",
    mimeType: "text/csv",
    note: "Small CSV batch for chain-grouping demos and history lookups.",
  },
  {
    id: "release-bundle-2026-04-24",
    label: "Release Bundle 2026-04-24",
    filename: "release-bundle-2026-04-24.json",
    publicPath: "/example-files/release-bundle-2026-04-24.json",
    chainId: "release-bundle-2026-04-24",
    sha256Hex:
      "cc64ca00a689fc59da77843b057dd2c7e3ccd9d9132f14b261a86cef0ec0ad09",
    mimeType: "application/json",
    note: "Structured JSON fixture for teams bootstrapping proof records from repo assets.",
  },
];
