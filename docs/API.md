# API Reference

## API Reference

All endpoints are served at `https://devguard.dakshagarwal.dev/api` (production) or `http://localhost:5000/api` (local).

### Health

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | None | Returns service status, uptime, Node version. Excluded from metrics instrumentation. |

### Code Analysis

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/analyze` | None | Single-file analysis. JSON body: `{ language, code }` |
| `POST` | `/api/analyze/multi` | None | Multi-file analysis. Multipart: `files[]`, optional `paths` JSON array |

**Single-file request:**
```json
{
  "language": "python",
  "code": "def greet(name):\n    print('Hello ' + name)"
}
```

**Single-file response:**
```json
{
  "suggestions": [
    {
      "line": 2,
      "type": "best-practice",
      "message": "Use f-strings instead of string concatenation",
      "replacement": { "from": "'Hello ' + name", "to": "f'Hello {name}'" },
      "source": "gemini"
    }
  ],
  "geminiReview": {
    "rawReview": "The function is simple. Consider using f-strings for modern Python.",
    "suggestions": []
  }
}
```

**Multi-file response:**
```json
{
  "results": [
    {
      "file": "src/main.py",
      "code": "...",
      "analysis": { "suggestions": [...], "geminiReview": {...} }
    }
  ]
}
```

> Multi-file requests are serialized through an in-memory queue â€” only one runs at a time to prevent CPU/memory saturation. Queue depth is tracked via the `devguard_review_queue_size` gauge.

### Feedback

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/feedback` | Bearer JWT | Store accept/reject decision for a suggestion |
| `GET` | `/api/feedback/all` | None | All feedback (filter with `?team_id=` or `?user_id=`) |
| `GET` | `/api/feedback/my/:teamId` | Bearer JWT | User's last 20 feedback items for a team |
| `POST` | `/api/feedback/submit` | Bearer JWT | Submit peer-to-peer feedback to a team member |
| `GET` | `/api/feedback/received/:teamId` | Bearer JWT | Peer feedback received by the current user |

### Teams

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/teams` | Bearer JWT | Create a team (creator becomes owner) |
| `GET` | `/api/teams/:teamId/join` | Bearer JWT | Join an existing team as member |
| `POST` | `/api/teams/:teamId/leave` | Bearer JWT | Leave a team (owners cannot leave) |
| `GET` | `/api/teams/:teamId/members` | Bearer JWT | Members list with per-member feedback stats |
| `GET` | `/api/teams/:teamId/analytics` | Bearer JWT | Team-level analytics aggregates |
| `GET` | `/api/teams/:teamId/dashboard` | Bearer JWT | Leader dashboard data (team lead only) |
| `GET` | `/api/teams/:teamId/my-feedback` | Bearer JWT | Personal feedback for member dashboard |
| `GET` | `/api/teams/:teamId/info` | Bearer JWT | Team info + current user membership details |
| `PATCH` | `/api/teams/:teamId/members/:userId/role` | Bearer JWT | Change member role (owner only) |
| `DELETE` | `/api/teams/:teamId/members/:userId` | Bearer JWT | Remove a member (owner only) |

### GitHub OAuth

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/github/callback` | None | Exchange authorization code for GitHub access token |

### Statistics and Metrics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/stats` | None | Global feedback statistics for admin dashboard |
| `GET` | `/metrics` | Basic auth | Prometheus scrape endpoint |

---
