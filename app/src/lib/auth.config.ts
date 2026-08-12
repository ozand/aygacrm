import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";

// Edge-safe config shared by middleware and the full server-side auth.
// Must NOT import Prisma, bcrypt, or any Node-only module.
export const authConfig = {
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.accountId = (user as any).accountId;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.isAccountAdministrator = (user as any).isAccountAdministrator;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).accountId = token.accountId;
        (session.user as any).firstName = token.firstName;
        (session.user as any).lastName = token.lastName;
        (session.user as any).isAccountAdministrator = token.isAccountAdministrator;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
