/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Initial TokenOps group member identity IDs. */
  readonly VITE_TOKEN_OPS_MEMBER_1_ID?: string;
  readonly VITE_TOKEN_OPS_MEMBER_2_ID?: string;
  readonly VITE_TOKEN_OPS_MEMBER_3_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
