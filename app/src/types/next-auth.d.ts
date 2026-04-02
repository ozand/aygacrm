import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      accountId: string;
      firstName: string | null;
      lastName: string | null;
      isAccountAdministrator: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    accountId: string;
    firstName: string | null;
    lastName: string | null;
    isAccountAdministrator: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    accountId: string;
    firstName: string | null;
    lastName: string | null;
    isAccountAdministrator: boolean;
  }
}
