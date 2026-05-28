# Dashnote Starter

A minimal React + Vite example for
[Dash Platform](https://docs.dash.org/platform). Full CRUD against a notes
contract on testnet: sign in with a BIP-39 mnemonic, create notes, edit them,
delete them. No theming, no toasts, no activity log — just the SDK calls and a
thin render layer.

Sits between two existing examples in this repo:

- [dashnote-lite.html](../dashnote/public/dashnote-lite.html) — single static
  HTML file, read-only, no build step. Browse public notes without signing in.
- **`dashnote-starter`** (this app) — React + Vite, full CRUD, mnemonic auth, no
  UX polish. The "I want to read this top-to-bottom and understand the SDK"
  tier.
- [dashnote](../dashnote/) — reference app with mobile layouts, activity log,
  theming, DPNS resolution, optimistic updates. Shows what a polished consumer
  of the SDK looks like.

## Run it

You need a funded testnet identity. The fastest way to get one is via
[Dash Bridge](https://bridge.thepasta.org/) — it generates a mnemonic, registers
an identity, and tops it up in one flow. Save the mnemonic; you'll paste it on
the sign-in screen.

```sh
npm install
npm run dev
```

Open the printed URL, paste the mnemonic, and you should see your (empty) note
list.

## What's in here

```text
src/
├── main.tsx          — React root
├── App.tsx           — session state + the four CRUD handlers
├── styles.css        — single plain stylesheet
├── components/
│   ├── SignIn.tsx    — mnemonic paste form
│   ├── NoteEditor.tsx — shared create/edit form
│   └── NoteList.tsx  — list with edit + delete buttons
├── dash/             — one file per Platform SDK operation
│   ├── client.ts         — createClient(network)
│   ├── keyManager.ts     — IdentityKeyManager (mnemonic → DIP-13 keys)
│   ├── sdkModule.ts      — cached dynamic import of @dashevo/evo-sdk
│   ├── contract.ts       — DEFAULT_CONTRACT_ID (see full app for the schema)
│   ├── createNote.ts     — sdk.documents.create
│   ├── updateNote.ts     — sdk.documents.get + sdk.documents.replace
│   ├── deleteNote.ts     — sdk.documents.delete
│   ├── queries.ts        — sdk.documents.query (list by owner)
│   └── types.ts          — shared SDK type aliases
└── lib/
    └── logger.ts     — tiny logger contract used by the dash/ helpers
```

The note contract is hardcoded to `8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y`
— the same one the full dashnote app uses by default. Notes you create here show
up in the full app, and vice versa.

## What's here

- **Sign in / sign out** — paste a mnemonic, identity is derived in-memory and
  never persisted; "Sign out" drops the session
- **Create / read / update / delete** notes against the hardcoded contract
- **Refresh** button to re-query the note list
- **Stale-revision detection** — passing `expectedRevision` to `updateNote`
  refuses the save if the network's revision moved while the editor was open
  (basic optimistic concurrency control)

## What's deliberately missing

In keeping with "render layer, not the subject," this app skips:

- WIF (private-key) auth — mnemonic only
- DPNS name resolution
- Contract registration UI — see the full app for `sdk.contracts.publish()`
- Activity log, toast notifications, theming
- Mobile-specific layouts
- localStorage cache, background revalidation, conflict-resolution UI
- React Context, custom hooks
- Tailwind, state libraries, animation libraries
- Tests — `npm run lint` + `tsc` are the only automated checks

If you want to see those patterns, read [`../dashnote/`](../dashnote/). If you
just want to understand which SDK calls are involved, start here.

## Note on the SDK chunk

`@dashevo/evo-sdk` ships ~8MB of WASM. A top-level static import in any file
reachable from `App.tsx` would block first paint. This app keeps the SDK off the
entry chunk via:

- A dynamic `import("../../../setupDashClient-core.mjs")` in `App.tsx` for
  `createClient` + `IdentityKeyManager`
- A cached dynamic import in `src/dash/sdkModule.ts` for value imports like
  `Document` + `Identifier`
- A `modulePreload.resolveDependencies` filter in `vite.config.ts` that strips
  the SDK chunk from auto-injected `<link rel="modulepreload">` tags

See [`../dashnote/CLAUDE.md`](../dashnote/CLAUDE.md) Performance section for the
full rules. If you're forking this app, don't add a top-level
`import { … } from "@dashevo/evo-sdk"` — it silently regresses FCP.
