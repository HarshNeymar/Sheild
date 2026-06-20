interface ImportMetaEnv {
  readonly VITE_STUDENT_SHIELD_API_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_STUDENT_SHIELD_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}