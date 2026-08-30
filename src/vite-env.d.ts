/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  readonly VITE_ANALYTICS_ENV?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
