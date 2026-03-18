# SignalBoard

A Node.js/Express + PostgreSQL feature voting API built as a deliberate engineering lab to practice API instrumentation, N+1 query diagnosis, PostgreSQL index optimization, and layered architecture with documented architectural decisions.

---

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 5
- **Database:** PostgreSQL
- **Validation:** Zod 4
- **Query instrumentation:** Custom `timedQuery` wrapper with structured JSON logging

---

## Setup

**Prerequisites:** Node.js 18+, PostgreSQL

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL=postgresql://localhost/signalboard

# Create tables (run schema SQL in psql)
psql -d signalboard

# Seed database with 50 users, 500 feature requests, 2000 votes
node src/db/seed.js

# Start development server
npm run dev
```

---

## Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/users` | Create a user |
| POST | `/requests` | Submit a feature request |
| GET | `/requests` | List all requests with vote counts |
| POST | `/votes` | Vote on a feature request |

See [`docs/api.md`](docs/api.md) for full request/response shapes and error codes.

---

## Performance Findings

### N+1 Query Fix (Day 3)

`GET /requests` was originally implemented with a loop that fired one COUNT query per feature request row.

| | Queries | Duration |
|---|---|---|
| Before (N+1 loop) | 501 | ~5856ms |
| After (LEFT JOIN) | 1 | ~263ms |

**22x faster. 500 fewer database round trips per request.**

### Index Strategy (Day 4)

Two indexes added after EXPLAIN ANALYZE diagnosis:
- `idx_votes_feature_request_id` — targets the LEFT JOIN condition
- `idx_feature_requests_status` — supports future status filter queries

At 500 rows, the PostgreSQL query planner correctly chose Seq Scan over Index Scan — sequential reads are faster at this data volume. Indexes are in place for when the data grows. See [ADR-004](docs/ADR-004-indexing.md).

---

## Architecture

4-layer separation of concerns: `routes → controllers → services → db`

Architectural decisions documented in [`docs/`](docs/):
- [ADR-001](docs/ADR-001-architecture.md) — Layered architecture and Zod validation
- [ADR-002](docs/ADR-002-instrumentation.md) — Structured logging and UUID correlation IDs
- [ADR-003](docs/ADR-003-n1-query-fix.md) — N+1 diagnosis and LEFT JOIN fix
- [ADR-004](docs/ADR-004-indexing.md) — PostgreSQL index strategy
- [ADR-005](docs/ADR-005-error-handling.md) — AppError class and centralized error handling

---

## Measurement Scripts

Capture and record query timing for before/after performance comparisons:

```bash
# Auto-capture timedQuery entries from server stdout
npm run dev 2>&1 | node scripts/capture-measurements.js

# Manually record a named snapshot
node scripts/record-measurement.js --day 3 --test "n1-before" --queries 501 --total_ms 5856
```

---

## Roadmap

### Day 6 — AI Digest Layer (`feature/ai-digest`)
`POST /digest` aggregates the last 24 hours of captured metrics and sends them to the Claude API, returning a natural language health summary with a prioritized recommendation. Digest is persisted to PostgreSQL for reproducibility.

### Day 7 — Prompt Observability Panel (`feature/prompt-observability`)
Every Claude API call is logged to a `prompt_logs` table capturing the full prompt, response, latency, and token counts. Exposed via `GET /prompts` and rendered in a WCAG 2.2 AA accessible React table — treating AI services as first-class instrumented components.
