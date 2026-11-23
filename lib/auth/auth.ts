import NextAuth from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "../db/prisma";

/*
  Database sessions: signing in creates a row in "Session" and the browser only
  holds an opaque random token (httpOnly cookie). Every request looks the token
  up, so signing out (or deleting the row) ends the session immediately.
*/
const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // idle sessions expire after 30 days
const SESSION_UPDATE_AGE = 24 * 60 * 60; // expiry is pushed forward at most once a day

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
    maxAge: SESSION_MAX_AGE,
    updateAge: SESSION_UPDATE_AGE,
  },
  providers: [
    AuthentikProvider({
      id: "authentik",
      name: "Authentik",
      clientId: process.env.AUTHENTIK_CLIENT_ID!,
      clientSecret: process.env.AUTHENTIK_CLIENT_SECRET!,
      issuer: process.env.AUTHENTIK_ISSUER,
      authorization: {
        url: `${process.env.AUTHENTIK_URL}/authorize/`,
        params: { scope: "openid email profile" },
      },
      token: `${process.env.AUTHENTIK_URL}/token/`,
      userinfo: `${process.env.AUTHENTIK_URL}/userinfo/`,
      profile(profile) {
        return {
          // Authentik's stable subject id. Auth.js stores it as
          // Account.providerAccountId, which is how a returning user is recognised.
          id: profile.sub,
          name: profile.name ?? profile.preferred_username ?? null,
          email: profile.email,
        };
      },
      // Don't persist Authentik access/refresh/ID tokens: the app never calls
      // Authentik APIs, so storing them would only add risk if the DB leaked.
      account(tokens) {
        return { scope: tokens.scope, token_type: tokens.token_type, expires_at: tokens.expires_at };
      },
    }),
  ],
  callbacks: {
    // With database sessions `user` is the User row the session belongs to.
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/sign-in", // custom login page
    error: "/sign-in", // auth errors land here as ?error=<code> (shown as a readable message)
  },
});
