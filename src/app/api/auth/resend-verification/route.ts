import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { db, initializeSchema } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { resendVerificationSchema } from "@/lib/validators";

export async function POST(request: Request) {
  try {
    await initializeSchema();
    const body = await request.json();
    const result = resendVerificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Find user
    const userResult = await db.execute({
      sql: "SELECT id, email_verified FROM users WHERE email = ?",
      args: [email],
    });

    // Don't reveal if email exists (security)
    if (
      userResult.rows.length === 0 ||
      (userResult.rows[0] as unknown as { email_verified: number }).email_verified
    ) {
      return NextResponse.json(
        {
          message:
            "If an unverified account exists with this email, a verification link has been sent.",
        },
        { status: 200 }
      );
    }

    // Generate new token
    const verificationToken = nanoid(32);
    const tokenExpires = new Date(
      Date.now() + 24 * 60 * 60 * 1000
    ).toISOString();

    await db.execute({
      sql: `UPDATE users SET verification_token = ?, verification_token_expires = ?, updated_at = datetime('now')
            WHERE id = ?`,
      args: [
        verificationToken,
        tokenExpires,
        (userResult.rows[0] as unknown as { id: string }).id,
      ],
    });

    await sendVerificationEmail({ email, token: verificationToken });

    return NextResponse.json(
      {
        message:
          "If an unverified account exists with this email, a verification link has been sent.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Resend verification error:", err);
    return NextResponse.json(
      { error: "Failed to resend verification email. Please try again." },
      { status: 500 }
    );
  }
}
