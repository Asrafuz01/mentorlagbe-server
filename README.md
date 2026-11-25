# MentorLagbe — Server

## Project Name & Purpose

**MentorLagbe** is a Smart Tuition & Mentorship Platform connecting **Students, Tutors, and Admins**. This repository contains the Node.js/Express REST API backed by MongoDB: JWT authentication, tuition and application workflows, admin moderation, Stripe payments, and connected demo seed data.

The companion Next.js client lives in the `mentorlagbe-client` repository.

## Live Site & Repositories

- **Live API:** https://mentorlagbe-server-blush.vercel.app
- **Client site:** https://mentorlagbe-client-g8ov.vercel.app
- **Client repository:** https://github.com/Asrafuz01/mentorlagbe-client
- **Server repository:** https://github.com/Asrafuz01/mentorlagbe-server

## Admin Credentials (Demo / Local Only)

No real credentials, passwords, tokens, or API keys are committed to this repository.

| Field | Placeholder / local setup |
| --- | --- |
| Email | `admin@mentorlagbe.com` (demo identity created by `npm run seed`) |
| Password | **Not committed.** The seed does not create a BetterAuth password. |
| Role | `admin` |
| JWT | Exchange a signed-in BetterAuth session at `POST /api/auth/jwt` |

Local admin setup:

1. Copy `.env.example` to `.env` and fill in local values. Never commit `.env`.
2. Set `BETTER_AUTH_SECRET` to the **same value** used by the Next.js client so this API can verify BetterAuth session cookies.
3. Run `npm run seed`. It upserts a demo admin record in the `users` collection with `role: "admin"` and no password.
4. Sign in from the Next.js client with the admin email's BetterAuth account (or promote a local BetterAuth user's `role` to `admin`), then let the client call `POST /api/auth/jwt`. The server derives the email from the verified session; request-body identity fields cannot select another account, an admin role, or a paid plan.
5. Send the returned token as `Authorization: Bearer <token>`, `x-auth-token`, or a `token` cookie on protected routes.

For seed-only local testing where no BetterAuth session exists, set `ALLOW_DEV_JWT_WITHOUT_SESSION=true` in `.env` and `NODE_ENV=development`. This fallback is ignored in production, never creates admin/paid users, and never promotes an existing account. Prefer the real session flow whenever possible.

Use placeholder credentials only. Keep `JWT_SECRET`, `BETTER_AUTH_SECRET`, `STRIPE_SECRET_KEY`, webhook secrets, price IDs, and MongoDB credentials in your local `.env`.

## Key Features

- **Express 5 REST API** in ESM with CORS for `CLIENT_URL`, JSON error handling, `/api/health`, and graceful shutdown.
- **JWT auth + role guards** (`verifyToken`, `verifyStudent`, `verifyTutor`, `verifyAdmin`) with `student` / `tutor` / `admin` roles.
- **Auth & profile routes:** token issuance, current user lookup, and safe profile updates.
- **Tuition APIs:** filtered public catalog, server-side search/filter/pagination, tutor-owned CRUD, pending approval, and Free Plan 2-listing limit.
- **Application APIs:** student submission with duplicate prevention, role-scoped listing, student cancellation, and tutor accept/reject.
- **Admin APIs:** user role management, all-status tuition moderation, transactions, and summary stats.
- **Stripe checkout, verification, and webhook:** `$10 student-pro` / `$15 tutor-pro` plans, configured price IDs with dynamic `price_data` fallback, raw-body signature verification, and idempotent payment/plan activation.
- **Connected demo seed script:** users, tuitions, applications, payments, bookmarks, and reviews with stable keys so repeat runs do not duplicate data.
- **MongoDB singleton connection** with collection getters for the six domain collections (`users`, `tuitions`, `applications`, `payments`, `bookmarks`, `reviews`) plus BetterAuth's `user` and `session` stores.

## Key npm Packages

| Package | Purpose |
| --- | --- |
| `express`, `cors` | HTTP server, routing, and cross-origin access |
| `mongodb` | Native MongoDB driver and collection access |
| `jsonwebtoken` | JWT signing and verification |
| `stripe` | Checkout sessions and webhook signature verification |
| `dotenv` | Environment loading from `.env` |

Node.js 20+ is required. There are no frontend framework packages in this repository.

## Environment Variables (Names Only)

Copy `.env.example` to `.env` and fill in local values:

```bash
PORT=5000
CLIENT_URL=http://localhost:3000
MONGODB_URI=<local-or-hosted-mongodb-uri>
DB_NAME=mentorlagbedb
JWT_SECRET=<local-random-secret>
BETTER_AUTH_SECRET=<same-better-auth-secret-as-client>
BETTER_AUTH_COOKIE_PREFIX=better-auth
ALLOW_DEV_JWT_WITHOUT_SESSION=false
STRIPE_SECRET_KEY=<local-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=<local-stripe-webhook-secret>
STRIPE_STUDENT_PRO_PRICE_ID=<local-student-pro-price-id>
STRIPE_TUTOR_PRO_PRICE_ID=<local-tutor-pro-price-id>
```

Stripe checkout returns a clear `503` JSON response when `STRIPE_SECRET_KEY` is missing. Database-backed routes return `503` when MongoDB is unavailable.

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in .env with local values
npm run dev
```

The API listens on `http://localhost:5000` by default. Check it with:

```bash
curl http://localhost:5000/api/health
```

Useful scripts:

```bash
npm run seed   # upsert connected demo data (requires MONGODB_URI)
npm start      # production-style start
npm test       # Node test runner
```

## API Overview

| Area | Base path | Notes |
| --- | --- | --- |
| Health | `/api/health` | Public server/database status |
| Auth | `/api/auth` | `POST /jwt` |
| Users | `/api/users` | `GET /me`, `PATCH|PUT /profile` |
| Tuitions | `/api/tuitions` | Catalog, details, tutor CRUD |
| Applications | `/api/applications` | Submit, list, cancel, status |
| Bookmarks | `/api/bookmarks` | Student-only saved tuitions; Free plan limit 5 |
| Reviews | `/api/reviews` | Public list, accepted-student 1–5 star reviews |
| Admin | `/api/admin` | Requires `verifyAdmin` |
| Payments | `/api/payments` | Checkout, verify, webhook |

All `/api/*` responses are JSON. Protected routes expect a JWT from `POST /api/auth/jwt`, which requires a valid BetterAuth session cookie unless the explicit local-dev fallback is enabled. Payment verification also requires the JWT of the customer who owns the checkout session. User and payment responses include logical-design aliases (`planTier`, `planName`, `transactionId`, `paymentStatus`, `paidAt`) alongside the canonical stored fields (`plan`, `status`, `stripePaymentIntentId`, timestamps) so older clients and seed data keep working.

## Demo Seed Data

`npm run seed` idempotently upserts:

- An admin, six tutors, and five students.
- **12 approved and active tuitions** across Math, Physics, Programming, IELTS, Chemistry, and English, plus pending/rejected listings for moderation.
- Sample applications linked to real demo students and tuitions, including accepted applications that back the demo reviews.
- Sample Stripe-style payment records linked to real demo users.
- Saved tuitions for demo students and 1–5 star reviews on approved tuitions, with cached tuition rating fields synced.

Stable `email` and `seedKey` filters make repeated runs safe. Existing records are kept rather than overwritten.

## Related Project

- Client app: `mentorlagbe-client` — Next.js UI, BetterAuth session handling, dashboards, and payment pages.
