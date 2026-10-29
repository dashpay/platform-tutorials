import { createClient } from "../../setupDashClient-core.mjs";

const sdk = await createClient("testnet");
const contractId = "HRAJ9564DHjbwRB1buhQtYxLiP97aCxMqa5Mgqy16Q3U";
const chainId = "dashcore-23-1-2-x86-64-linux-gnu-tar";
const entryHash = [
  124, 77, 80, 71, 162, 82, 158, 25, 118, 233, 87, 249, 93, 92, 159, 98, 139,
  39, 105, 62, 225, 177, 31, 206, 18, 169, 249, 190, 33, 131, 58, 118,
];

const queries = [
  {
    name: "no_filter",
    query: {
      dataContractId: contractId,
      documentTypeName: "anchor",
      limit: 5,
    },
  },
  {
    name: "chain_filter",
    query: {
      dataContractId: contractId,
      documentTypeName: "anchor",
      where: [["chainId", "==", chainId]],
      orderBy: [
        ["chainId", "asc"],
        ["$createdAt", "asc"],
      ],
      limit: 5,
    },
  },
  {
    name: "hash_filter",
    query: {
      dataContractId: contractId,
      documentTypeName: "anchor",
      where: [["entryHash", "==", entryHash]],
      orderBy: [["entryHash", "asc"]],
      limit: 5,
    },
  },
];

for (const { name, query } of queries) {
  try {
    const results = await sdk.documents.query(query);
    const normalized =
      results instanceof Map
        ? Array.from(results.entries())
        : Array.isArray(results)
          ? results.map((doc, i) => [String(i), doc])
          : Object.entries(results);

    console.log(
      JSON.stringify(
        {
          name,
          ok: true,
          count: normalized.length,
          ids: normalized.map(([id]) => id),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.log(
      JSON.stringify(
        {
          name,
          ok: false,
          message: error?.message ?? String(error),
          stack: error?.stack ?? null,
        },
        null,
        2,
      ),
    );
  }
}
