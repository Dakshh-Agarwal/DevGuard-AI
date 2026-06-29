# Security & Authentication

## Security

**JWT verification** — All protected routes call `supabase.auth.getUser(token)` server-side on every request. The token is never trusted without server-side validation.

**OAuth CSRF protection** — A random `state` parameter is generated client-side, stored in `sessionStorage`, and verified on redirect before the authorization code is used.

**OAuth code deduplication** — An in-memory `Set` prevents the same authorization code from being exchanged twice. Codes are removed from the Set after 5 minutes.

**Metrics endpoint protection** — `/metrics` requires HTTP Basic Authentication. Credentials are set via environment variables, not hardcoded.

**Log sanitization** — Metadata keys containing `authorization`, `token`, `access_token`, `api_key`, `apikey`, `password`, `secret`, `client_secret`, or `cookie` are replaced with `[REDACTED]` before any log is emitted.

**CORS allowlist** — The backend accepts cross-origin requests only from:
- `https://devguard.dakshagarwal.dev`
- `https://d79onb379axx.cloudfront.net`
- `http://localhost:5173`
- `http://localhost:3000`

**Role enforcement** — Team owner actions (remove member, change roles) verify the requesting user's role from Supabase before executing. Admin routes check the `is_admin` flag in the `profiles` table.

**Known gaps:**
- No rate limiting on analysis endpoints
- HTTPS termination must be handled by a reverse proxy or load balancer in front of the Express server
- No input size limits on submitted code beyond Gemini's token budget

---

## Authentication and Authorization

### Supabase JWT Verification

```
Client              Backend                Supabase
  â”‚                    â”‚                      â”‚
  â”œâ”€ Bearer JWT â”€â”€â”€â”€â”€â”€â”€â–ºâ”‚                     â”‚
  â”‚                    â”œâ”€ getUser(token) â”€â”€â”€â”€â”€â–ºâ”‚
  â”‚                    â”‚â—„â”€ { user } â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚
  â”‚                    â”‚  setRequestUserId(user.id)  â† AsyncLocalStorage
  â”‚                    â”‚  req.user = user
  â”‚                    â””â”€ proceed to handler
```

`verifyUserToken` calls `supabase.auth.getUser(token)` server-side on every protected request. After verification, it calls `setRequestUserId(user.id)`, which writes the user ID into `AsyncLocalStorage` — making it available to every downstream log line without explicit parameter passing.

### GitHub OAuth Flow

```
1. Frontend generates random state â†’ stores in sessionStorage â†’ redirects user to GitHub
2. GitHub redirects to /github-callback?code=...&state=...
3. Frontend verifies state matches sessionStorage value (CSRF protection)
4. Frontend POSTs { code } to /api/github/callback
5. Backend exchanges code for access_token via GitHub's token endpoint
6. Backend fetches GitHub user profile and returns both to the frontend
7. Frontend stores access_token in localStorage for subsequent GitHub API calls
```

**Duplicate code protection:** The server maintains an in-memory `Set` of already-exchanged OAuth codes. If the same code arrives twice (possible with React StrictMode double-mount), the second request returns HTTP 400 immediately. Codes are removed from the Set after 5 minutes.

### Role-Based Access

| Role | Access |
|---|---|
| Unauthenticated | Home page, login, signup, code analysis (no feedback storage) |
| Authenticated user | Code editor, feedback submission, team join/create |
| Team member | Member dashboard, team analytics, peer feedback |
| Team owner | Leader dashboard, member management, role changes |
| Admin (`is_admin: true` in profiles) | Admin dashboard, global statistics |

---
