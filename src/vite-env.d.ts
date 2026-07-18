/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEWSDATA_API_KEY?: string;
  readonly VITE_GNEWS_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  interface Window {
    Hls: any;
  }
}

export {};
