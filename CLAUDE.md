
  You are an expert in TypeScript, Node.js, Next.js App Router, React, Shadcn UI, and Tailwind.
  
  Code Style and Structure
  - Write concise, technical TypeScript code with accurate examples.
  - Use functional and declarative programming patterns; avoid classes.
  - Prefer iteration and modularization over code duplication.
  - Use descriptive variable names with auxiliary verbs (e.g., isLoading, hasError).
  - Structure files: exported component, subcomponents, helpers, static content, types.

  Project Structure
  - Use app/ directory for App Router (layout.tsx, page.tsx, api/).
  - Place UI components in components/ (shadcn or custom).
  - Store custom React hooks in hooks/.
  - Keep client helpers and API wrappers in lib/.
  - Put Tailwind customizations in styles/.
  - Store static assets in public/.
  
  Naming Conventions
  - Use lowercase with dashes for directories (e.g., components/auth-wizard).
  - Favor named exports for components.
  
  TypeScript Usage
  - Use TypeScript for all code; prefer interfaces over types.
  - Avoid enums; use maps instead.
  - Use functional components with TypeScript interfaces.
  
  Syntax and Formatting
  - Use the "function" keyword for pure functions.
  - Avoid unnecessary curly braces in conditionals; use concise syntax for simple statements.
  - Use declarative JSX.
  
  UI and Styling
  - Always use shadcn/ui components first before creating custom components.
  - Check available shadcn/ui components with `npx shadcn@latest add` before building from scratch.
  - Use Tailwind CSS for custom styling and layout.
  - Implement responsive design with Tailwind CSS; use a mobile-first approach.
  - Follow shadcn/ui patterns: use the `cn()` utility for conditional classes.
  - Prefer Radix UI primitives (via shadcn) for accessible, unstyled components when shadcn doesn't have what you need.
  
  Performance Optimization
  - Minimize 'use client', 'useEffect', and 'setState'; favor React Server Components (RSC).
  - Wrap client components in Suspense with fallback.
  - Use dynamic loading for non-critical components.
  - Optimize images: use WebP format, include size data, implement lazy loading.
  
  Key Conventions
  - Use 'nuqs' for URL search parameter state management.
  - Optimize Web Vitals (LCP, CLS, FID).
  - Limit 'use client':
    - Favor server components and Next.js SSR.
    - Use only for Web API access in small components.
    - Avoid for data fetching or state management.
  
  Follow Next.js docs for Data Fetching, Rendering, and Routing.

Project-Specific Instructions
This is ClientHappy, a structured client-feedback tool. Key points:
- Live app: https://app.clienthappy.com
- Landing page: https://clienthappy.com (separate repo: client-happy-landing)
- Database: Turso (libSQL)
- File storage: Vercel Blob (uploads no longer go to public/uploads/)
- Routes: /admin/* for management, /projects/[slug] for client voting
- Entities: Projects -> Pages -> Sections -> Screenshots -> Votes
- Use nanoid for generating IDs
- Use Zod validators from lib/validators/ for input validation
- Type interfaces in types/index.ts with row converters

Multi-User Security Requirements
- All admin pages MUST verify user authentication via `auth()` from `@/lib/auth`
- All database queries for admin pages MUST filter by `user_id` to ensure users only see their own data
- Use `WHERE user_id = ?` for direct project queries
- Use `AND p.user_id = ?` when joining through projects table
- For API routes, use helper functions from `@/lib/auth/api-auth.ts` (e.g., `userOwnsProject`, `userOwnsQuestion`)
- Always redirect to `/login` if session is missing: `if (!session?.user) redirect("/login")`
- Public routes (/projects/[slug]) do NOT require auth - they are accessed by clients via shared links
  
