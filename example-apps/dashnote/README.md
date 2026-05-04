# Dashnote — Dash Platform Notes

`Dashnote` is a React + TypeScript + Vite example app for personal notes on Dash Platform testnet.

The app stays close to the tutorial `note` contract shape, but extends it with an optional `title`, a required `message`, and required Platform timestamps. Notes are editable, deletable, and shown in a calm two-pane notebook UI.

## Prerequisites

- Node >= 20
- A funded Dash Platform testnet identity (BIP-39 mnemonic + identity index) for write operations
- Read-only mode works without any identity — visitors can read notes for any identity ID against the bundled contract

## Quick start

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build         # tsc -b && vite build
npm run test          # Vitest suite
npm run lint          # ESLint
npm run format        # Prettier (write)
npm run format:check  # Prettier (check only)
npm run preview       # Serve the production build
```

## Current app behavior

- The app auto-connects in read-only mode on load against the bundled default contract.
- Creating, editing, and deleting notes requires login with a testnet identity.
- The primary screen is a flat recent-notes list plus a note editor/detail pane.
- `title` is optional; `message` is required.
- If `title` is blank, the UI uses the first non-empty line of `message`.
- If both are blank, the note renders as `Untitled`.
- Field length is enforced in **bytes**, not characters; the editor's progress bar reflects the UTF-8 budget.

## Contract and Settings flow

- The app ships with a bundled deployed note contract ID (`8d6heK6CoskLBi6Rs7cChRG9RuckcZqZst28BdviBe8y`) so read-only browse and verification flows work immediately on a fresh machine.
- The login modal becomes a Settings modal after authentication.
- Settings can:
  - paste and reuse an existing note contract ID
  - register a fresh Dashnote note contract on testnet
  - switch the app to that newly registered contract immediately
- Overrides persist under `localStorage['dashnote.contractId']`. Clearing storage falls back to the bundled default.

## Contract schema notes

- The schema in [`src/dash/contract.ts`](./src/dash/contract.ts) defines a single document type, `note`, with `title` (optional, max 120 chars), `message` (required, max 10000 chars), and required Platform-managed `$createdAt` / `$updatedAt`.
- Indices: `byOwnerUpdated` (`$ownerId`, `$updatedAt`) and `byOwnerCreated` (`$ownerId`, `$createdAt`) — both are how the recent-notes list paginates and sorts.
- `documentsMutable: true` and `canBeDeleted: true` — notes are editable and deletable.
- `keepsHistory` is forced to `false`. `keepsHistory: true` triggers [dashpay/platform#3165](https://github.com/dashpay/platform/issues/3165), where `sdk.contracts.fetch()` returns undefined and breaks `sdk.documents.query` with "Data contract not found". This is why v1 only shows revision metadata, not previous versions of notes.

## Platform operations at a glance

Every SDK call lives in its own file under [`src/dash/`](./src/dash/). Open the file to see the full implementation with a JSDoc header naming the SDK method it wraps.

| Operation              | File                                                 | SDK method                                    |
| ---------------------- | ---------------------------------------------------- | --------------------------------------------- |
| Connect to testnet     | [`src/dash/client.ts`](./src/dash/client.ts)         | `EvoSDK.testnetTrusted()` + `sdk.connect()`   |
| Derive identity keys   | [`src/dash/keyManager.ts`](./src/dash/keyManager.ts) | wallet/key derivation helpers                 |
| Register note contract | [`src/dash/contract.ts`](./src/dash/contract.ts)     | `sdk.contracts.publish`                       |
| Create a note          | [`src/dash/createNote.ts`](./src/dash/createNote.ts) | `sdk.documents.create`                        |
| Update a note          | [`src/dash/updateNote.ts`](./src/dash/updateNote.ts) | `sdk.documents.get` + `sdk.documents.replace` |
| Delete a note          | [`src/dash/deleteNote.ts`](./src/dash/deleteNote.ts) | `sdk.documents.delete`                        |
| List my notes          | [`src/dash/queries.ts`](./src/dash/queries.ts)       | `sdk.documents.query`                         |
| Get one note           | [`src/dash/queries.ts`](./src/dash/queries.ts)       | `sdk.documents.get`                           |

Update flow always fetches the document first to read its current revision, then submits a replace with `revision = BigInt(existing.revision ?? 0) + 1n`. Replays without bumping the revision are rejected by the state transition.

Supporting files:

- **[`src/dash/types.ts`](./src/dash/types.ts)** — shared SDK types (`DashSdk`, `DashKeyManager`, query result shapes) wired through every dash helper.
- **[`src/lib/logger.ts`](./src/lib/logger.ts)** — `Logger` function type and `errorMessage(err)` helper. Plumbed through every dash call so progress messages stream to the activity log and `level: "success" | "error"` raise sonner toasts.
- **[`src/lib/notesCache.ts`](./src/lib/notesCache.ts)** — localStorage-backed note list keyed by `identityId + contractId + network`. Powers optimistic paint on reload before background revalidation completes.
- **[`src/lib/rememberedIdentity.ts`](./src/lib/rememberedIdentity.ts)** — last-logged-in identity ID for read-only browse. Never stores the mnemonic.

## Reading the codebase

Recommended order for understanding how the app works:

1. **[`src/dash/`](./src/dash/)** — start here. One file per Platform operation, each with a JSDoc block naming the SDK method. Read [`createNote.ts`](./src/dash/createNote.ts) first (simplest write flow), then [`updateNote.ts`](./src/dash/updateNote.ts) (the fetch → bump revision → replace pattern).

2. **[`src/dash/contract.ts`](./src/dash/contract.ts)** — the `note` schema, indices, and the `registerContract` / `ensureContract` helpers used by Settings.

3. **[`src/session/SessionContext.tsx`](./src/session/SessionContext.tsx)** — manages the SDK connection, identity, contract ID, and activity log. The mnemonic never enters React state; it lives only inside the `keyManager` closure and is garbage-collected on logout. The consumer hook lives in [`useSession.ts`](./src/session/useSession.ts).

4. **[`src/components/`](./src/components/)** — standard React UI. [`NotesWorkspace.tsx`](./src/components/NotesWorkspace.tsx) is the two-pane list + editor with optimistic cache and background revalidation. [`NoteEditor.tsx`](./src/components/NoteEditor.tsx) is the fused title/body editor with a UTF-8 byte-budget progress bar. [`LoginModal.tsx`](./src/components/LoginModal.tsx) wires the paste-or-register contract flow.

5. **[`src/hooks/`](./src/hooks/)** — [`useTheme`](./src/hooks/useTheme.ts) for dark mode, [`useMediaQuery`](./src/hooks/useMediaQuery.ts) for the mobile-vs-desktop layout switch via `window.matchMedia`.

6. **[`src/lib/`](./src/lib/)** — pure utilities, no SDK references: [`fieldLimits.ts`](./src/lib/fieldLimits.ts) (UTF-8 byte counters), [`format.ts`](./src/lib/format.ts), plus `logger.ts` / `notesCache.ts` / `rememberedIdentity.ts` described above.

For deeper architecture and gotchas, see [`CLAUDE.md`](./CLAUDE.md).

## Tests

[`test/`](./test/) uses Vitest + Testing Library, flat-not-mirrored, named after the subject under test. The default Vitest environment is Node; component tests opt into jsdom per-file with `// @vitest-environment jsdom`. Run with `npm run test`.

The suite covers:

- contract schema and registration config
- note query normalization and sorting
- create / update / delete mutation helpers
- note-title fallback formatting
- notes cache load/save/clear and revision-equality
- remembered identity persistence
- notebook UI flows for auth gating, create, update, and delete

## Tech stack

- React 19
- TypeScript
- Vite 8
- Tailwind CSS v4
- Vitest 4 + Testing Library
- `@dashevo/evo-sdk`
- sonner (toasts)
