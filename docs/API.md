# API Reference

All endpoints are served at `https://devguard.dakshagarwal.dev/api` (production) or `http://localhost:5000/api` (local).

---

## Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Returns service status, uptime, and Node.js version. Excluded from metrics instrumentation. |

**Response:**
```json
{
  "status": "ok",
  "service": "devguard-backend",
  "timestamp": "2026-06-30T10:00:00.000Z",
  "uptime": 86400,
  "node_version": "v20.18.0"
}
```

---

## Code Analysis

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/analyze` | None | Single-file analysis. JSON body: `{ language, code }` |
| `POST` | `/api/analyze/multi` | None | Multi-file analysis. Multipart: `files[]`, optional `paths` JSON array |

### Single-File Request

```json
{
  "language": "python",
  "code": "def greet(name):\n    print('Hello ' + name)"
}
```

### Single-File Response

```json
{
  "suggestions": [
    {
      "line": 2,
      "type": "best-practice",
      "message": "Use f-strings for string formatting",
      "replacement": { "from": "'Hello ' + name", "to": "f'Hello {name}'" },
      "source": "gemini"
    }
  ],
  "geminiReview": {
    "rawReview": "The function works but could use modern Python conventions.",
    "suggestions": [...]
  }
}
```

### Multi-File Request

Multipart `POST` with:
- `files[]` — one or more source files
- `paths` (optional) — JSON array of file paths to preserve directory context

### Multi-File Response

```json
{
  "results": [
    {
      "file": "src/utils.js",
      "code": "...",
      "analysis": {
        "suggestions": [...],
        "geminiReview": { "rawReview": "...", "suggestions": [...] }
      }
    }
  ]
}
```

**Supported languages:** Python (`.py`), JavaScript (`.js`, `.jsx`, `.ts`, `.tsx`), Java (`.java`), C/C++ (`.c`, `.cpp`, `.h`)

---

## Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/feedback` | JWT | Store accept/reject decision for a suggestion |
| `GET` | `/api/feedback/my` | JWT | Get current user's feedback history |
| `GET` | `/api/feedback/team/:teamId` | JWT | Get all feedback for a team |
| `GET` | `/api/feedback/team/:teamId/stats` | JWT | Aggregated team feedback statistics |

### Submit Feedback

```json
{
  "language": "javascript",
  "originalCode": "var x = 1;",
  "suggestionText": "Use let or const instead of var",
  "action": "accepted",
  "optionalReason": "Good suggestion",
  "source": "gemini",
  "suggestion_type": "best-practice"
}
```

The `action` field must be `"accepted"` or `"rejected"`. Rejected suggestions with comments are fed back into subsequent Gemini prompts for the same code, preventing the AI from repeating unwanted suggestions.

---

## Teams

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/teams` | JWT | Create a new team (caller becomes owner) |
| `GET` | `/api/teams/my-teams` | JWT | List teams the user belongs to |
| `GET` | `/api/teams/:teamId` | JWT | Get team details |
| `POST` | `/api/teams/:teamId/join` | JWT | Join a team via invite link |
| `DELETE` | `/api/teams/:teamId/leave` | JWT | Leave a team |
| `GET` | `/api/teams/:teamId/members` | JWT | List team members with roles |
| `PATCH` | `/api/teams/:teamId/members/:userId/role` | JWT | Update a member's role (owner/leader only) |
| `DELETE` | `/api/teams/:teamId/members/:userId` | JWT | Remove a member (owner/leader only) |
| `GET` | `/api/teams/:teamId/leader-stats` | JWT | Leader dashboard analytics |

### Create Team

```json
{ "team_name": "Backend Squad" }
```

**Response:**
```json
{
  "team_id": "uuid-here",
  "join_link": "https://devguard.dakshagarwal.dev/join/uuid-here"
}
```

---

## Dashboard Statistics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stats` | None | Admin dashboard — aggregated feedback stats, user activity, language breakdown |
| `GET` | `/api/stats/debug-users` | None | Debug endpoint for user fetch testing |

---

## GitHub OAuth

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/github/test` | None | Health check for the GitHub route |
| `POST` | `/api/github/callback` | None | Exchange GitHub OAuth code for access token and user info |

### OAuth Callback

```json
{ "code": "github_oauth_code_here" }
```

**Response:**
```json
{
  "access_token": "gho_...",
  "token_type": "bearer",
  "scope": "read:user",
  "github_user": { "login": "username", "id": 12345, "avatar_url": "..." }
}
```

The backend maintains an in-memory `Set` of recently exchanged codes to prevent duplicate token exchange attempts. Codes are automatically cleaned up after 5 minutes.

---

## Rejections

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/rejections` | JWT | Get rejection history for the current user |

---

## Metrics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/metrics` | Basic Auth | Prometheus scrape endpoint. Returns all 20 custom metrics + Node.js defaults in OpenMetrics format. |

Authentication uses HTTP Basic Auth with credentials configured via `METRICS_USER` and `METRICS_PASS` environment variables.

---
