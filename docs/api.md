# SignalBoard API Reference

## Overview

SignalBoard is a feature voting API. All responses are JSON. All errors follow a consistent shape so developers can handle failures without defensive parsing or per-endpoint special cases.

**Base URL:** `http://localhost:3000`

---

## Consistent Patterns

All errors follow `{ "error": "...", "code": "..." }`. Validation errors add a `details` field with per-field messages. Every response includes an `X-Request-Id` header linking the request to server logs — include it in bug reports.

| Code | Status | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Request body failed schema validation |
| `DUPLICATE_VOTE` | 409 | User has already voted on this request |
| `INTERNAL_ERROR` | 500 | Unexpected server error — check server logs |

---

## Endpoints

### POST /users
Creates a new user.

**Request body:**
```json
{ "email": "user@example.com" }
```

**Success — 201:**
```json
{ "id": 1, "email": "user@example.com", "created_at": "2026-03-08T..." }
```

**Errors:**
| Status | Code | When |
|---|---|---|
| 500 | `INTERNAL_ERROR` | Duplicate email or unexpected error |

---

### POST /requests
Creates a new feature request. `status` defaults to `open` if not provided.

**Request body:**
```json
{
  "title": "Dark mode",
  "description": "Optional description",
  "status": "open",
  "user_id": 1
}
```

| Field | Type | Required | Constraints |
|---|---|---|---|
| `title` | string | yes | min 1 character |
| `description` | string | no | — |
| `status` | string | no | `open`, `in-progress`, or `shipped`. Defaults to `open` |
| `user_id` | integer | yes | positive integer |

**Success — 201:**
```json
{
  "id": 1,
  "title": "Dark mode",
  "description": "Optional description",
  "status": "open",
  "user_id": 1,
  "created_at": "2026-03-08T..."
}
```

**Errors:**
| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing title, invalid status, non-integer user_id |
| 500 | `INTERNAL_ERROR` | Unexpected error |

---

### GET /requests
Returns all feature requests with vote counts.

**No request body.**

**Success — 200:**
```json
[
  {
    "id": 1,
    "title": "Dark mode",
    "description": "Optional description",
    "status": "open",
    "user_id": 1,
    "created_at": "2026-03-08T...",
    "vote_count": 42
  }
]
```

**Errors:**
| Status | Code | When |
|---|---|---|
| 500 | `INTERNAL_ERROR` | Unexpected error |

---

### POST /votes
Records a vote from a user on a feature request. Each user can vote once per request.

**Request body:**
```json
{ "user_id": 1, "feature_request_id": 1 }
```

**Success — 201:**
```json
{
  "id": 1,
  "user_id": 1,
  "feature_request_id": 1,
  "created_at": "2026-03-08T..."
}
```

**Errors:**
| Status | Code | When |
|---|---|---|
| 409 | `DUPLICATE_VOTE` | User has already voted on this feature request |
| 500 | `INTERNAL_ERROR` | Unexpected error |
