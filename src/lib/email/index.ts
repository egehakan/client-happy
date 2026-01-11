import { Resend } from "resend";
import { getVerificationEmailTemplate } from "./templates";

// Lazy initialization to avoid errors at build time
let resend: Resend | null = null;

function getResendClient(): Resend {
  if (!resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY environment variable is not set");
    }
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

interface SendVerificationEmailParams {
  email: string;
  token: string;
}

export async function sendVerificationEmail({
  email,
  token,
}: SendVerificationEmailParams) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyUrl = `${baseUrl}/verify-email?token=${token}`;

  const { error } = await getResendClient().emails.send({
    from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
    to: email,
    subject: "Verify your email - ClientHappy",
    html: getVerificationEmailTemplate(verifyUrl),
  });

  if (error) {
    console.error("Failed to send verification email:", error);
    throw new Error("Failed to send verification email");
  }
}
