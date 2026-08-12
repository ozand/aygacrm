import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const AUTH_PAGES = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const isAuthPage = AUTH_PAGES.some((p) => nextUrl.pathname.startsWith(p));

  // Authed users should not sit on login/register
  if (isLoggedIn && isAuthPage) {
    return Response.redirect(new URL("/dashboard", nextUrl));
  }

  // Unauthed users hitting protected app routes -> login with return-to
  if (!isLoggedIn && !isAuthPage) {
    const callbackUrl = nextUrl.pathname + nextUrl.search;
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", callbackUrl);
    return Response.redirect(loginUrl);
  }

  return undefined;
});

export const config = {
  // Run on dashboard app routes and auth pages; skip api, next internals, static, files with extensions
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|auth/error|.*\\..*).*)"],
};
