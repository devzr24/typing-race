import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username?: string;
    isGuest?: boolean;
  }

  interface Session {
    user: {
      id: string;
      username: string;
      isGuest: boolean;
    } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    username?: string;
    isGuest?: boolean;
  }
}
