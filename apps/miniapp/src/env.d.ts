/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MINIAPP_API_BASE_URL: string;
  readonly VITE_COMMERCIAL_SERVICES_ENABLED?: string;
  readonly VITE_QUALIFICATION_WORKFLOW_ENABLED?: string;
  readonly VITE_DEMO_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
