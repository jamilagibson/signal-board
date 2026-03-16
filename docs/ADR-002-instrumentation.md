# ADR-002: Structured Logging, UUID Correlation IDs, and Measurement Capture

**Date:** 2026-03-06
**Status:** Accepted
**Branch:** feature/instrumentation

---

## Context

With four endpoints returning real database data, the next requirement was observability: the ability to watch the terminal and know exactly where time is spent on any given request. This matters for two reasons:

1. **Immediate:** Day 3 N+1 diagnosis and Day 4 index optimization require real timing numbers. Without instrumentation in place before those days, there is no baseline to measure against.
2. **Production relevance:** In a real system, unstructured logs are difficult to query, correlate, or alert on. Building structured logging habits early reflects professional practice.

---

## Decision

### 1. Structured JSON logs at every layer

All log output — both request-level (`requestLogger`) and query-level (`timedQuery`) — is emitted as `JSON.stringify(...)` rather than prose strings.

**Why:** Structured logs are parseable by monitoring tools (Datadog, CloudWatch, Grafana Loki) without configuration. A log line like `{"query":"SELECT * FROM feature_requests","duration_ms":4.2,"rows":500}` can be filtered, aggregated, and alerted on. A prose string like `"query took 4ms"` cannot.

**Accessibility principle:** Consistent log shape means any engineer can read and act on the logs without asking for context. This is the same "fail clearly" principle applied to observability: make the system's behavior legible to anyone watching.

### 2. UUID correlation IDs via `crypto.randomUUID()`

Every request is assigned a UUID at the start of `requestLogger`, attached to `req.requestId` and the `X-Request-Id` response header.

**Why:** A correlation ID links the request log and all query logs for a single request into a traceable unit. With concurrent traffic, logs interleave — without a correlation ID there is no way to know which query log belongs to which request.

**`X-Request-Id` in the response header:** Travels back to the caller so they can include it in bug reports. DevEx and API accessibility pattern.

**`crypto.randomUUID()` over the `uuid` package:** Node 18+ ships UUID v4 natively. No dependency needed — smaller attack surface, no version management.

### 3. `process.hrtime.bigint()` for request timing

**Why:** `Date.now()` returns integer milliseconds and is subject to system clock adjustments. `process.hrtime.bigint()` returns nanoseconds from a monotonic clock. Dividing by `1e6` gives milliseconds with two decimal places — surfacing differences that `Date.now()` would round away.

### 4. Measurement capture scripts

- **`scripts/capture-measurements.js`:** Pipes server stdout, identifies `timedQuery` entries by JSON shape, appends to `logs/measurements.json`.
- **`scripts/record-measurement.js`:** CLI tool for manually snapshotting aggregate measurements with a day number and test label. Enables before/after comparison across Day 3 and Day 4.

`logs/measurements.json` is gitignored — runtime data, not source code.

### 5. Seed data via `generate_series`

500 feature requests and 2000 votes inserted in single queries inside Postgres. Provides the volume needed to make N+1 and index performance differences measurable rather than theoretical.

---

## Alternatives Considered

**`morgan` for request logging:** Already in `package.json` but produces formatted strings, not structured JSON, and doesn't support correlation IDs without custom tokens.

**`uuid` package:** Rejected in favor of `crypto.randomUUID()`. See decision 2.

---

## Consequences

**Positive:**
- Every request produces correlated log lines across `requestLogger` and `timedQuery`
- Log shape is consistent and machine-parseable from day one
- No new runtime dependencies added
- Measurement scripts provide a quantitative baseline for Day 3 and Day 4

**Tradeoffs:**
- `console.log` to stdout is not suitable for high-throughput production use
- Correlation ID is not threaded into `timedQuery` logs — a full trace would require passing `requestId` down the call stack or using `AsyncLocalStorage`
