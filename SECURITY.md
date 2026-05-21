# Security Policy

## Supported versions

This project is maintained as a single rolling `main` branch. Only the latest commit on `main` receives security fixes. There are no LTS releases.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues, discussions, or pull requests.**

Instead, report them by email to:

**hakan@egehakankaraagac.com**

Include as much of the following as you can:

- A description of the vulnerability and its potential impact
- Steps to reproduce (proof-of-concept, request samples, or screenshots)
- The affected file(s), route(s), or endpoint(s)
- Your name and any disclosure preferences (whether you'd like to be credited)

You should receive an acknowledgement within **5 business days**. If you do not, please follow up — your report may have been filtered.

## What to expect

- **Triage** within 5 business days.
- **Fix or mitigation timeline** communicated within 14 days of confirmation.
- **Public disclosure** coordinated with you. We will not disclose your identity without permission.

## Scope

In scope:

- Authentication and authorization flaws (e.g. accessing another user's projects, votes, or questionnaires)
- Injection vulnerabilities (SQL, command, XSS, SSRF)
- Insecure direct object references (IDOR)
- File upload bypasses or malicious-file storage issues
- Secrets or credentials leaking in responses, logs, or error pages
- CSRF on state-changing endpoints

Out of scope:

- Issues that require physical access to a user's device
- Denial-of-service via volumetric attacks
- Issues in third-party services (Turso, Vercel Blob, Resend) — please report directly to the upstream vendor
- Outdated dependency reports without a working exploit
- Best-practice violations without security impact (e.g. missing security headers on a static asset)

## Hall of fame

Researchers who report valid vulnerabilities will be credited here (with permission) once a fix has shipped.
