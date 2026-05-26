/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_GITHUB_SYNC_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
