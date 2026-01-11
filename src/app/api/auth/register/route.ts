import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import bcrypt from "bcryptjs";
import { db, initializeSchema } from "@/lib/db";
import { registerSchema } from "@/lib/validators";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(request: Request) {
  try {
    await initializeSchema();
    const body = await request.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = result.data;

    // Check if email already exists
    const existingUser = await db.execute({
      sql: "SELECT id, email_verified FROM users WHERE email = ?",
      args: [email],
    });

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0] as unknown as { id: string; email_verified: number };
      if (user.email_verified) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        );
      }
      // User exists but not verified - could resend verification
      return NextResponse.json(
        {
          error:
            "An account with this email exists but is not verified. Please check your email or request a new verification link.",
        },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate verification token
    const verificationToken = nanoid(32);
    const tokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString(); // 24 hours

    // Create user
    const userId = nanoid();
    await db.execute({
      sql: `INSERT INTO users (id, email, password_hash, email_verified, verification_token, verification_token_expires)
            VALUES (?, ?, ?, 0, ?, ?)`,
      args: [userId, email, passwordHash, verificationToken, tokenExpires],
    });

    // Send verification email
    await sendVerificationEmail({ email, token: verificationToken });

    return NextResponse.json(
      {
        message:
          "Registration successful. Please check your email to verify your account.",
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Failed to register. Please try again." },
      { status: 500 }
    );
  }
}
