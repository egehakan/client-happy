import { NextResponse } from "next/server";
import { db, initializeSchema } from "@/lib/db";

export async function GET(request: Request) {
  try {
    await initializeSchema();
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Verification token is required" },
        { status: 400 }
      );
    }

    // Find user with this token
    const result = await db.execute({
      sql: "SELECT id, email_verified, verification_token_expires FROM users WHERE verification_token = ?",
      args: [token],
    });

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: "Invalid or expired verification link" },
        { status: 400 }
      );
    }

    const user = result.rows[0] as unknown as {
      id: string;
      email_verified: number;
      verification_token_expires: string;
    };

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { message: "Email already verified. You can log in." },
        { status: 200 }
      );
    }

    // Check token expiration
    const expiresAt = new Date(user.verification_token_expires);
    if (new Date() > expiresAt) {
      return NextResponse.json(
        { error: "Verification link has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Mark email as verified and clear token
    await db.execute({
      sql: `UPDATE users
            SET email_verified = 1, verification_token = NULL, verification_token_expires = NULL, updated_at = datetime('now')
            WHERE id = ?`,
      args: [user.id],
    });

    return NextResponse.json(
      { message: "Email verified successfully. You can now log in." },
      { status: 200 }
    );
  } catch (err) {
    console.error("Verification error:", err);
    return NextResponse.json(
      { error: "Verification failed. Please try again." },
      { status: 500 }
    );
  }
}
