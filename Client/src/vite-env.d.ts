/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Base URL of the Node.js backend, for example https://api.prestar.example/api (set it in .env)
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}