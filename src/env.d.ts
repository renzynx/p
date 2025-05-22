interface ImportMetaEnv {
  readonly PUBLIC_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type User = {
  id: string;
  email: string;
  username: string;
  avatar: string;
  discord_id: string;
  token_expiry: string;
};

declare namespace App {
  interface Locals {
    isAuthenticated: boolean;
    user: User | null;
    cookie: string | null;
  }
}
