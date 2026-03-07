# ADR-001: Layered Architecture with Boundary-Enforced Validation

**Date:** 2026-03-05
**Status:** Accepted
**Branch:** feat/layered-endpoints

---

## Context

SignalBoard is a Node/Express + PostgreSQL API for submitting and voting on feature requests. From the first endpoint, we needed an architecture that would:

- Make the codebase navigable without explanation
- Isolate changes so modifying one concern does not require touching unrelated files
- Support deliberate performance engineering in later days (N+1 diagnosis, index optimization)
- Demonstrate professional-grade backend patterns appropriate for a portfolio project and interview discussion

---

## Decision

We adopted a strict four-layer architecture for every endpoint:

```
routes → controllers → services → db
```

Each layer has one job and one direction of dependency — layers only call downward, never upward.

| Layer | Responsibility | Knows about |
|---|---|---|
| `routes/` | Register HTTP method + path → controller function | Express Router |
| `controllers/` | Parse request, validate input, send response | HTTP, Zod, services |
| `services/` | Execute business logic, unwrap db results | db layer only |
| `db/` | Translate function calls to SQL via `timedQuery` | pg, pool |

---

## Supporting Decisions

### 1. Zod validation at the controller boundary — API accessibility principle

Input validation fires in the controller, at the HTTP boundary, before any service or database logic runs. This is a deliberate application of **fail early, fail clearly**:

- A malformed request is rejected immediately with a structured `{ error, code, details }` response
- The `details` field (via `z.flattenError()`) returns per-field error messages that a client can display directly, without transformation
- Invalid input never reaches the service or db layer, so business logic and SQL never run against bad data

This makes the API accessible to consumers: errors are predictable, structured, and descriptive. A consumer does not need to defensively parse error responses or guess what went wrong.

**Zod 4 note:** During implementation, TypeScript's language server flagged two successive deprecated Zod APIs inline — `error.flatten()` (deprecated in Zod 4) and then `error.format()` (also deprecated) — before either was committed. Both were caught at author time in the editor via VS Code's Problems panel, not at runtime. The correct Zod 4 API is `z.flattenError(error)`, a static function that returns the same `{ formErrors, fieldErrors }` shape as the original `flatten()`. This is shift-left in practice: the toolchain surfaced a breaking change before it could affect a running system.

### 2. `timedQuery` instrumentation in the db layer — shift-left observability

Every database call routes through `timedQuery`, which logs structured JSON (`{ query, duration_ms, rows }`) on every execution. Instrumentation was added at the infrastructure layer before the first endpoint was written — not retrofitted after a performance problem appeared.

This makes Day 3 N+1 diagnosis and Day 4 index optimization possible without adding new tooling. The cost of slow queries is visible in the logs from the first request.

### 3. Consistent error shapes across all endpoints

All error responses follow `{ error, code }`, with an optional `details` field for validation errors. Known failure modes are caught at the controller and mapped to the correct HTTP status:

- Validation failure → `400` with `VALIDATION_ERROR` and per-field details
- Duplicate vote (PostgreSQL error `23505` unique_violation) → `409` with `DUPLICATE_VOTE`
- Unexpected errors → `500` with `INTERNAL_ERROR`

Consumers can handle all errors with a single pattern, without per-endpoint special cases.

### 4. Services have zero knowledge of `req` or `res`

Service functions accept plain arguments and return plain data. They can be called by a controller, a test, a CLI script, or a cron job without modification. This is what makes business logic testable in isolation — no HTTP server or database connection required to unit test a service function.

---

## Alternatives Considered

**Flat structure — all logic in route handlers**
Rejected. Route handlers that contain validation, business logic, and SQL become untestable and impossible to reason about as the API grows.

**Two layers — routes + combined service/db**
Rejected. Collapsing service and db logic makes it impossible to swap the database without touching business rules, and impossible to test business logic without a real database connection.

**MVC**
Not applicable. There is no view layer in a JSON API. The four-layer model is a better fit because it makes the db boundary explicit — which is where the performance engineering in this project is focused.

---

## Consequences

**Positive:**
- Each file has a single, articulable responsibility
- The db layer can be replaced (e.g., Postgres → SQLite) by changing only `src/db/`
- Business logic is testable without an HTTP server or database connection
- Performance instrumentation is present on every query from day one
- Error handling is consistent and predictable for any API consumer
- Fail early, fail clearly: invalid input is rejected at the boundary with structured, human-readable errors

**Tradeoffs:**
- More files per feature than a flat structure
- Thin service functions feel like indirection until business logic grows into them
- Layer boundaries are enforced by convention, not by the framework — requires discipline to maintain
