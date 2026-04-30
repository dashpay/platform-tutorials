# Patchbook — Dash Platform Notes Lab

`Patchbook` is a React + TypeScript + Vite example app for personal notes on Dash Platform testnet.

The app stays close to the tutorial `note` contract shape, but extends it with an optional `title`, a required `message`, and required Platform timestamps. Notes are editable, deletable, and shown in a calm two-pane notebook UI.

## Quick start

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build
npm run test
npm run lint
```

## Current app behavior

- The app auto-connects in read-only mode on load.
- Creating, editing, and deleting notes requires login with a testnet identity.
- The primary screen is a flat recent-notes list plus a note editor/detail pane.
- `title` is optional.
- If `title` is blank, the UI uses the first non-empty line of `message`.
- If both are blank in the UI, the note is treated as `Untitled`.
- v1 history means `createdAt`, `updatedAt`, and `revision`.
- v1 does not reconstruct older note bodies.

## Contract and Settings flow

- Patchbook does not ship with a bundled default contract ID.
- After login, Settings can:
  - paste and reuse an existing note contract ID
  - register a fresh Patchbook note contract on testnet
  - switch the app to that contract immediately

## Platform operations

Every SDK call lives under [`src/dash/`](./src/dash/):

- [`contract.ts`](./src/dash/contract.ts) — contract schema + registration
- [`createNote.ts`](./src/dash/createNote.ts) — create a note document
- [`updateNote.ts`](./src/dash/updateNote.ts) — replace an existing note document
- [`deleteNote.ts`](./src/dash/deleteNote.ts) — delete a note document
- [`queries.ts`](./src/dash/queries.ts) — list notes and fetch one note

## Tests

Vitest covers:

- contract schema and registration config
- note query normalization and sorting
- create / update / delete mutation helpers
- note-title fallback formatting
- notebook UI flows for auth gating, create, update, and delete
