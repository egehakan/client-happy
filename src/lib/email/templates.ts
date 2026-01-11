export function getVerificationEmailTemplate(verifyUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px 20px; background-color: #f4f4f5;">
        <div style="max-width: 480px; margin: 0 auto; background: white; border-radius: 8px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <h1 style="margin: 0 0 24px; font-size: 24px; color: #18181b;">Verify your email</h1>
          <p style="margin: 0 0 24px; color: #52525b; line-height: 1.6;">
            Thanks for signing up for ClientHappy! Please click the button below to verify your email address.
          </p>
          <a href="${verifyUrl}"
             style="display: inline-block; background: #18181b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Verify Email
          </a>
          <p style="margin: 24px 0 0; color: #a1a1aa; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.
          </p>
          <hr style="margin: 24px 0; border: none; border-top: 1px solid #e4e4e7;">
          <p style="margin: 0; color: #a1a1aa; font-size: 12px;">
            Or copy this link: ${verifyUrl}
          </p>
        </div>
      </body>
    </html>
  `;
}
