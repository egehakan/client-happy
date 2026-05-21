# Contributing to ClientHappy

Thanks for your interest. A few things to know before you start.

## License of contributions

ClientHappy is released under [PolyForm Noncommercial 1.0.0](./LICENSE.md) — a source-available, noncommercial license. By submitting a pull request, you agree that your contribution will be made available under the same license.

If you are unwilling or unable to license your contribution under these terms, please do not open a pull request.

## Before you start

- For non-trivial changes (new features, refactors, schema changes), please **open an issue first** so we can discuss direction. This avoids large PRs being rejected on scope.
- Small fixes (typos, bug fixes, dead code removal) are fine to send as a PR directly.

## Development setup

See the "Getting started" section of the [README](./README.md). You will need:

- Node.js 20+, pnpm
- A Turso database (free tier)
- A Vercel Blob token (free tier)
- A Resend API key

```bash
pnpm install
cp .env.example .env.local  # fill in values
pnpm dev
```

## Code style

This codebase follows the conventions described in [`CLAUDE.md`](./CLAUDE.md):

- TypeScript everywhere; prefer interfaces over type aliases.
- Functional components, server-first — minimize `'use client'`.
- shadcn/ui first; fall back to Radix primitives if not available.
- Tailwind for styling. Use the `cn()` utility for conditional classes.
- Use `nanoid` for IDs, Zod for input validation.

Run before submitting:

```bash
pnpm lint
pnpm build
```

## Multi-user / security expectations

This app supports multiple admin users. Any code that touches the database **must** preserve these guarantees:

- Admin pages must verify auth via `auth()` from `@/lib/auth` and redirect to `/login` if no session.
- Admin queries must scope by `user_id` (direct or joined through projects).
- Public client routes (`/projects/[slug]`) do **not** require auth and must not leak data outside the requested project.

A PR that weakens these guarantees will not be merged.

## Pull request checklist

- [ ] My change is small enough to review, or I opened an issue first.
- [ ] `pnpm lint` and `pnpm build` pass.
- [ ] I added/updated relevant docs if behavior changed.
- [ ] I have not committed secrets, real client data, or `.env*` files.
- [ ] I agree to license my contribution under PolyForm Noncommercial 1.0.0.

## Reporting bugs

Open a GitHub issue. Include:

- What you did, what you expected, what actually happened.
- Environment (Node version, OS, browser).
- Minimal reproduction steps.

## Security vulnerabilities

**Do not file a public issue for security problems.** See [SECURITY.md](./SECURITY.md).
