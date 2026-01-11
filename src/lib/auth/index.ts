import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db, initializeSchema } from "@/lib/db";
import { nanoid } from "nanoid";
import type { UserRow } from "@/types";

// Schema for env users
const envUserSchema = z.array(
  z.object({
    email: z.string().email(),
    password: z.string().min(1),
  })
);

// Parse users from env
function getEnvUsers() {
  const usersJson = process.env.AUTH_USERS;
  if (!usersJson) return [];
  try {
    return envUserSchema.parse(JSON.parse(usersJson));
  } catch {
    console.error("Invalid AUTH_USERS format");
    return [];
  }
}

// Sync env users to database (upsert)
// Env users are auto-verified and passwords are hashed
export async function syncUsersFromEnv() {
  await initializeSchema();
  const envUsers = getEnvUsers();

  for (const user of envUsers) {
    const existing = await db.execute({
      sql: "SELECT id, password_hash FROM users WHERE email = ?",
      args: [user.email],
    });

    // Hash the password from env
    const passwordHash = await bcrypt.hash(user.password, 12);

    if (existing.rows.length === 0) {
      // Insert new user (auto-verified for env users)
      await db.execute({
        sql: "INSERT INTO users (id, email, password_hash, email_verified) VALUES (?, ?, ?, 1)",
        args: [nanoid(), user.email, passwordHash],
      });
    } else {
      // Update password if changed (compare hashes)
      const existingUser = existing.rows[0] as unknown as { password_hash: string };
      const passwordChanged = !(await bcrypt.compare(
        user.password,
        existingUser.password_hash
      ));

      if (passwordChanged) {
        await db.execute({
          sql: "UPDATE users SET password_hash = ?, email_verified = 1, updated_at = datetime('now') WHERE email = ?",
          args: [passwordHash, user.email],
        });
      }
    }
  }
}

// Custom error for email not verified
class EmailNotVerifiedError extends Error {
  constructor() {
    super("EMAIL_NOT_VERIFIED");
    this.name = "EmailNotVerifiedError";
  }
}

// Validate credentials with bcrypt and email verification check
async function validateCredentials(email: string, password: string) {
  await syncUsersFromEnv();

  const result = await db.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email],
  });

  if (result.rows.length === 0) return null;

  const user = result.rows[0] as unknown as UserRow;

  // Verify password with bcrypt
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) return null;

  // Check if email is verified
  if (!user.email_verified) {
    throw new EmailNotVerifiedError();
  }

  return { id: user.id, email: user.email };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string;
        const password = credentials?.password as string;

        if (!email || !password) return null;

        try {
          return await validateCredentials(email, password);
        } catch (error) {
          if (error instanceof EmailNotVerifiedError) {
            throw new Error("Please verify your email before logging in.");
          }
          return null;
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.email = user.email as string;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  trustHost: true,
});
