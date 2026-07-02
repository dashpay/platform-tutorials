/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Initial Triage Panel member identity IDs, written by scripts/bootstrap-identities.mjs. */
  readonly VITE_PANELIST_1_ID?: string;
  readonly VITE_PANELIST_2_ID?: string;
  readonly VITE_PANELIST_3_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
