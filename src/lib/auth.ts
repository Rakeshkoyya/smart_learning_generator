import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

declare module "next-auth" {
  interface User {
    role?: string;
    is_approved?: boolean;
  }
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
      is_approved: boolean;
    };
  }
}

declare module "next-auth" {
  interface JWT {
    id: string;
    role: string;
    is_approved: boolean;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "Admin Login",
      credentials: {
        email: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        const user = await prisma.user.findFirst({
          where: { email, auth_provider: "credentials" },
        });

        if (!user || !user.password_hash) return null;

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar_url,
          role: user.role,
          is_approved: user.is_approved,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (existing) {
          await prisma.user.update({
            where: { id: existing.id },
            data: {
              name: user.name,
              avatar_url: user.image,
            },
          });

          user.id = existing.id;
          user.role = existing.role;
          user.is_approved = existing.is_approved;
        } else {
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              avatar_url: user.image,
              role: "user",
              is_approved: false,
              auth_provider: "google",
            },
          });

          user.id = newUser.id;
          user.role = newUser.role;
          user.is_approved = newUser.is_approved;
        }
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role || "user";
        token.is_approved = user.is_approved ?? false;
      }

      // Refresh user data from DB only on explicit session update
      // (not every request — middleware runs in Edge where Prisma isn't available)
      if (trigger === "update") {
        const tokenId = token.id as string;
        if (tokenId) {
          const dbUser = await prisma.user.findUnique({
            where: { id: tokenId },
            select: { role: true, is_approved: true },
          });

          if (dbUser) {
            token.role = dbUser.role;
            token.is_approved = dbUser.is_approved;
          }
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.is_approved = token.is_approved as boolean;
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
