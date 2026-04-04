import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { supabase } from "./supabase";

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
    accessToken?: string;
  }
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

        const { data: user } = await supabase
          .from("users")
          .select("*")
          .eq("email", email)
          .eq("auth_provider", "credentials")
          .single();

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
        const { data: existing } = await supabase
          .from("users")
          .select("*")
          .eq("email", user.email!)
          .single();

        if (existing) {
          await supabase
            .from("users")
            .update({ name: user.name, avatar_url: user.image })
            .eq("id", existing.id);

          user.id = existing.id;
          user.role = existing.role;
          user.is_approved = existing.is_approved;
        } else {
          const { data: newUser } = await supabase
            .from("users")
            .insert({
              email: user.email!,
              name: user.name,
              avatar_url: user.image,
              role: "pending",
              is_approved: false,
              auth_provider: "google",
            })
            .select()
            .single();

          if (newUser) {
            user.id = newUser.id;
            user.role = newUser.role;
            user.is_approved = newUser.is_approved;
          }
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
      if (trigger === "update") {
        const tokenId = token.id as string;
        if (tokenId) {
          const { data: dbUser } = await supabase
            .from("users")
            .select("role, is_approved")
            .eq("id", tokenId)
            .single();

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
      
      // Create a standard HS256 signed JWT for backend API calls
      const secret = new TextEncoder().encode(process.env.AUTH_SECRET!);
      session.accessToken = await new SignJWT({
        sub: token.id as string,
        id: token.id as string,
        email: session.user.email,
        role: token.role as string,
        is_approved: token.is_approved as boolean,
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("30d")
        .sign(secret);
      
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days - persist session across browser closes
  },
});
