# MentorLagbe server conventions

- Stack: Node.js 20+, Express (ESM, `"type": "module"`), MongoDB native driver, Stripe; serves the Next.js client at `CLIENT_URL`.
- Collections: `users`, `tuitions`, `applications`, `payments`. Access them only through the getters in `src/config/db.js`.
- Keep environment access in `src/config/env.js`. Never commit `.env` — commit only `.env.example`.
- All `/api/*` responses are JSON; CORS must allow `CLIENT_URL` with `credentials: true`.
- Add new endpoints as focused route modules under `src/routes/` and mount them in `src/server.js`.
- Auth: `POST /api/auth/jwt` signs tokens with `JWT_SECRET`; protect routes with `verifyToken` and the `verifyStudent` / `verifyTutor` / `verifyAdmin` guards from `src/middlewares/auth.middleware.js`.
- After every completed step, create a clean, meaningful Git commit with a conventional prefix (`feat:`, `fix:`, `chore:`, `docs:`) so this repo builds toward 12+ server commits.
