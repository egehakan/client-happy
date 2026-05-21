# ClientHappy

A structured feedback tool for agencies, freelancers, and product teams. Share a link with a client and let them vote Yes / Maybe / No on screenshots and answer questionnaires about their preferences — instead of chasing scattered comments across email, chat, and calls.

> **License:** Source-available under [PolyForm Noncommercial 1.0.0](./LICENSE.md). You can read, fork, run, and modify this for personal, research, educational, and non-profit use. **Commercial use — including running it as a paid service or as part of a commercial offering — is not permitted.** See the LICENSE for full terms.

## What it does

- **Visual voting** — Upload screenshots, group them by page and section, share a link. Clients vote and leave comments per screenshot.
- **Questionnaires** — Build typed questions (text, choice, color, file upload) grouped by topic. Clients answer at their own pace with auto-save.
- **Organized output** — All responses are stored per-respondent. Admins can browse, filter, and export votes + questionnaire answers as ZIP.
- **No client login** — Clients access via a shareable link, identified by their email. Admins authenticate normally.

See [`APP_DOCUMENTATION.txt`](./APP_DOCUMENTATION.txt) for a deeper walkthrough of entities, flows, and architecture.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4, shadcn/ui, Radix UI primitives
- **Database:** Turso (libSQL / SQLite) via `@libsql/client`
- **Auth:** NextAuth v5 (credentials + email verification)
- **File storage:** Vercel Blob
- **Email:** Resend
- **Validation:** Zod
- **Forms:** react-hook-form + `@hookform/resolvers`

## Getting started

### Prerequisites

- Node.js 20+
- `pnpm` (or `npm` / `yarn` — examples use pnpm)
- A Turso database ([sign up](https://turso.tech/))
- A Vercel Blob token (free tier works)
- A Resend API key (for verification emails)

### Setup

```bash
git clone https://github.com/egehakan/client-happy.git
cd client-happy
pnpm install
cp .env.example .env.local
# fill in the values in .env.local — see below
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment variables

See `.env.example` for the full list. At minimum:

| Variable | Description |
| --- | --- |
| `TURSO_DATABASE_URL` | libSQL connection URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `RESEND_API_KEY` | Resend API key for email verification |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `NEXT_PUBLIC_APP_URL` | Public app URL (e.g. `http://localhost:3000`) |

### Routes

- `/admin/*` — authenticated admin area (projects, screenshots, questions, responses)
- `/projects/[slug]` — public client-facing voting/questionnaire flow
- `/login`, `/register` — admin auth

## Contributing

Contributions are welcome under the same noncommercial license. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a PR and review the [Code of Conduct](./CODE_OF_CONDUCT.md). Security issues: see [SECURITY.md](./SECURITY.md).

## License

[PolyForm Noncommercial 1.0.0](./LICENSE.md). This is a source-available license, not OSI-approved "open source." Commercial use requires a separate license from the author.

For commercial licensing inquiries: **hakan@egehakankaraagac.com**
