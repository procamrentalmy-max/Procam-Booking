# ProCam

Action-camera rental for hotel/hostel guests. Guests scan a partner QR at
reception and self-serve the entire rental through this app; reception's job
is limited to handing over and receiving a numbered camera pouch.

See [`.claude/plans/harmonic-sauteeing-kurzweil.md`](.claude/plans/harmonic-sauteeing-kurzweil.md)
for the full architecture, database model, state machines, and phased build
plan this project follows.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Auth + Storage)
- Stripe (rental fee: auto-capture; security deposit: authorize/capture hold)
- Deployed on Vercel

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Supabase/Stripe/Resend keys
npm run dev
```

### Database

Schema lives in `supabase/migrations/`, seed data in `supabase/seed.sql`.
Against a Supabase project (local via the Supabase CLI + Docker, or a hosted
dev project):

```bash
npx supabase link --project-ref <ref>   # or `supabase start` for local
npx supabase db reset                   # applies migrations + seed.sql
```

Regenerate `lib/db/types.ts` from the real schema once a project exists
(see the comment at the top of that file) instead of hand-editing it further.

## Project structure

- `app/` — routes (customer, reception, staff, admin surfaces land here as
  they're built)
- `lib/state-machine/` — camera/booking/deposit transition rules, enforced
  server-side regardless of caller
- `lib/supabase/` — `server.ts` (RLS-scoped, request-bound), `browser.ts`
  (staff/reception client components), `service.ts` (privileged, server-only,
  bypasses RLS — used for customer-facing writes since customers never hold a
  Supabase session)
- `lib/db/types.ts` — schema types
- `supabase/` — migrations + seed data
