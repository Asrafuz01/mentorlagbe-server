# MentorLagbe server conventions

- Stack: Node.js 20+, Express (ESM, `"type": "module"`), MongoDB native driver, Stripe; serves the Next.js client at `CLIENT_URL`.
- Collections: `users`, `tuitions`, `applications`, `payments`. Access them only through the getters in `src/config/db.js`.
- Keep environment access in `src/config/env.js`. Never commit `.env` — commit only `.env.example`.
- All `/api/*` responses are JSON; CORS must allow `CLIENT_URL` with `credentials: true`.
- Add new endpoints as focused route modules under `src/routes/` and mount them in `src/server.js`.
- Auth: `POST /api/auth/jwt` signs tokens with `JWT_SECRET` and syncs BetterAuth profile fields into `users`; an explicit non-admin role from the session syncs for non-admin users, while admin roles and purchased plans stay server-owned and are refreshed per request. Protect routes with `verifyToken` and the `verifyStudent` / `verifyTutor` / `verifyAdmin` guards from `src/middlewares/auth.middleware.js`.
- Tuitions/applications: `/api/tuitions` serves a filtered public catalog plus tutor-owned CRUD; `/api/applications` is role-scoped by email. Tutor-owned records stay pending until admin approval, and Free Plan tutors may keep at most 2 listings.
- Admin/payments: `/api/admin` requires `verifyAdmin`; Stripe routes live under `/api/payments` and use `STRIPE_SECRET_KEY`. Keep the raw request body available for webhook signature checks and fulfill paid sessions idempotently.
- Seed data: run `npm run seed` to upsert connected demo users, tuitions, applications, and payments. Stable `seedKey` / email filters make repeat runs safe.
- Audit fixes: public tuition detail and application submission require approved/active listings; application status moves only from pending; admins cannot change their own role; checkout uses the JWT identity and stores purchased plan names.
- After every completed step, create a clean, meaningful Git commit with a conventional prefix (`feat:`, `fix:`, `chore:`, `docs:`) so this repo builds toward 12+ server commits.
