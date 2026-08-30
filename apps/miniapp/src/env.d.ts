/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MINIAPP_API_BASE_URL: string;
  readonly VITE_COMMERCIAL_SERVICES_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
