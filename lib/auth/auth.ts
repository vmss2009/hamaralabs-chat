import NextAuth from "next-auth";
import AuthentikProvider from "next-auth/providers/authentik";
import { ensureUserExists } from "../db/auth/user";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
          name: profile.name,
          email: profile.email,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, profile }) {
      // Normalise an internal user id we control.
      if (user) {
        const providerSub = (profile as any)?.sub as string | undefined;
        const resolvedId = providerSub || (user as any).id || (token.sub as string) || crypto.randomUUID();
        token.id = resolvedId;
        token.sub = providerSub || token.sub;
        try {
          await ensureUserExists(resolvedId, user.email as string, {
            name: user.name,
            email: user.email,
          });
        } catch (e) {
          console.error('[auth.ensureUserExists] failed', e);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (!session.user) (session as any).user = {};
      (session.user as any).id = token.id as string;
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/sign-in", // Redirect to custom login page
  },
});