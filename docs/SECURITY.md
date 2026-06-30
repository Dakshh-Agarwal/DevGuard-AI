# Security

## Authentication

### Supabase JWT Verification

All protected routes use the `verifyUserToken` middleware. It extracts the `Bearer` token from the `Authorization` header and calls `supabase.auth.getUser(token)` to validate the JWT server-side. If verification succeeds, the user object is attached to `req.user` and the `user_id` is injected into `AsyncLocalStorage` for downstream logging.

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

If the token is missing or invalid, the middleware returns `401 Unauthorized` immediately. No route handler executes.

### GitHub OAuth

GitHub OAuth is implemented via `POST /api/github/callback`. The flow:

1. The frontend redirects the user to GitHub's authorization page with the `client_id`.
2. GitHub redirects back to the frontend with a one-time `code` parameter.
3. The frontend sends the `code` to the backend.
4. The backend exchanges the code for an `access_token` with GitHub's OAuth API using the `client_secret` (never exposed to the client).
5. The backend fetches the GitHub user profile and returns the token and user info.

### Duplicate Code Guard

GitHub OAuth codes are single-use. If the frontend's React `useEffect` fires twice (due to `StrictMode` or double-mounting), the same code is sent to the backend twice. The second exchange attempt would fail with `bad_verification_code` from GitHub.

To prevent this, the backend maintains an in-memory `Set` of recently exchanged codes. If a code has already been processed, the backend returns `400` immediately instead of making a failing call to GitHub. Codes are automatically cleaned from the set after 5 minutes to prevent memory growth.

---

## CORS Configuration

The Express server restricts cross-origin requests to a whitelist of known origins:

```javascript
cors({
  origin: [
    'https://devguard.dakshagarwal.dev',
    'https://d79onb379axx.cloudfront.net',
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true
})
```

Requests from unlisted origins are rejected by the browser before reaching route handlers.

---

## Metrics Endpoint Protection

The Prometheus `/metrics` endpoint is protected with HTTP Basic Authentication. Credentials are configured via `METRICS_USER` and `METRICS_PASS` environment variables (defaults: `admin` / `devguard-metrics`).

Prometheus authenticates with these same credentials in its scrape configuration:

```yaml
basic_auth:
  username: admin
  password: devguard-metrics
```

Without valid credentials, the endpoint returns `401` with a `WWW-Authenticate: Basic realm="Metrics"` header.

---

## Log Sanitization

The Winston logger includes a recursive sanitization function that redacts sensitive fields before any log line is written (to console, Loki, or any transport). The following field names trigger redaction:

| Sanitized Fields |
|---|
| `authorization` |
| `token` |
| `access_token` |
| `api_key` / `apikey` |
| `password` |
| `secret` |
| `client_secret` |
| `service_role_key` |
| `supabase_service_role_key` |
| `gemini_api_key` |
| `cookie` |

Matching is case-insensitive and uses `includes()`, so fields like `x_api_key` or `Authorization` are also caught. Matched values are replaced with `[REDACTED]`. The sanitizer recurses through nested objects and arrays.

---

## Role-Based Access Control

### Team Roles

Teams have three roles:

| Role | Capabilities |
|---|---|
| **Owner** | Full control — manage members, change roles, delete team |
| **Leader** | View leader dashboard, manage member roles, review team activity |
| **Member** | Submit code for review, view personal dashboard, accept/reject suggestions |

Role checks are performed server-side by querying the `team_members` table for the authenticated user's `role` field before executing privileged operations.

### Admin Access

The frontend includes an admin-only route (`/admin`) protected by `AdminProtectedRoute`. This component queries the `profiles` table for `is_admin = true` on the authenticated user. The admin dashboard shows system-wide analytics (all feedback, all users, language breakdowns).

---

## Request Tracing

Every incoming request is assigned a UUID `request_id` via `AsyncLocalStorage`. This ID:

1. Is attached to `req.requestId`
2. Is set as the `X-Request-ID` response header
3. Is injected into every log line by the Winston logger
4. Is written alongside `user_id` (populated after auth middleware runs)

This enables end-to-end request tracing across all log lines for a single request, even across asynchronous operations like Gemini API calls and database queries.

If the incoming request already includes an `X-Request-ID` header (e.g., from a load balancer), that value is reused instead of generating a new one.

---

## Unhandled Exception Safety

The server registers global handlers for both `uncaughtException` and `unhandledRejection`:

- **Uncaught exceptions** are logged with full stack traces, then the process exits after a 1-second delay (to allow the logger to flush to Loki).
- **Unhandled rejections** are logged but do not crash the process, since they may be transient (e.g., a network timeout).

---

## Known Limitations

- **No rate limiting.** The analysis endpoints do not enforce per-user or per-IP rate limits. A malicious client could submit unlimited analysis requests.
- **No CSRF tokens on API.** The backend relies on CORS origin checking and JWT authentication rather than explicit CSRF tokens. This is standard for SPA-to-API architectures but differs from traditional server-rendered applications.
- **Basic auth on /metrics.** The metrics endpoint uses HTTP Basic Auth, which transmits credentials in base64. Within the Docker bridge network this is acceptable (traffic is internal), but it should be upgraded to mTLS or network-level restrictions if the endpoint is exposed publicly.
- **In-memory OAuth code cache.** The duplicate code guard uses a `Set` in process memory. If the server restarts between a user's GitHub redirect and their callback, the guard will not detect a duplicate (though this is a non-critical edge case).

---
