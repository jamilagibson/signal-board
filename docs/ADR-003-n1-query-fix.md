# ADR-003: Replacing N+1 Query Pattern with LEFT JOIN in GET /requests

**Date:** 2026-03-07
**Status:** Accepted
**Branch:** fix/n1-query

---

## Context

`GET /requests` was implemented on Day 1 with a deliberate N+1 anti-pattern:
one `SELECT * FROM feature_requests` followed by one `SELECT COUNT(*) FROM votes`
per row. With 500 seeded feature requests this produced 501 queries per request.

Day 2 instrumentation (`timedQuery`) made the cost visible in the terminal — 501
structured JSON log lines per `GET /requests` call. Day 3 diagnosis confirmed the
numbers and drove the fix.

---

## Measured Impact

| | Queries | Duration |
|---|---|---|
| Before (N+1 loop) | 501 | ~5856ms |
| After (LEFT JOIN) | 1 | ~263ms |

**22x faster. 500 fewer database round trips per request.**

---

## Decision

Replace the N+1 loop with a single query using `LEFT JOIN` and `GROUP BY`:

```sql
SELECT feature_requests.*,
       COUNT(votes.id)::int AS vote_count
FROM feature_requests
LEFT JOIN votes ON votes.feature_request_id = feature_requests.id
GROUP BY feature_requests.id
ORDER BY feature_requests.id
```

**Why `LEFT JOIN` not `INNER JOIN`:** An inner join only returns rows that have
a matching row in both tables. Feature requests with zero votes have no rows in
the votes table — an inner join would silently drop them from the response.
`LEFT JOIN` keeps all feature requests and returns 0 for vote_count when there
are no matching votes. This is a correctness concern, not just a performance one.

**Why `COUNT(votes.id)::int` not `COUNT(*)`:** `COUNT(votes.id)` counts only
non-null vote IDs, correctly returning 0 for feature requests with no votes.
`COUNT(*)` would return 1 for those rows because it counts the row itself.
The `::int` cast handles the conversion in SQL so the service receives a proper
integer — no `parseInt()` needed in JavaScript.

---

## Why the N+1 Was Preserved Until Now

The anti-pattern was introduced intentionally on Day 1 with a comment marking it
for Day 3 diagnosis. Fixing it before measuring would have eliminated the evidence.
The instrumentation built on Day 2 (`timedQuery`, `requestLogger`, measurement
scripts) made it possible to capture real numbers before and after — turning a
theoretical problem into a documented, quantified fix.

---

## Alternatives Considered

**Subquery instead of JOIN:**
```sql
SELECT *,
  (SELECT COUNT(*) FROM votes WHERE feature_request_id = feature_requests.id) AS vote_count
FROM feature_requests
```
Correct but typically slower than a JOIN with GROUP BY at this scale. JOIN approach
is more idiomatic and easier to extend (e.g. adding filters or sorting by vote count).

---

## Consequences

**Positive:**
- 501 queries → 1 query per `GET /requests` request
- Response time reduced from ~5856ms to ~263ms with 500 rows
- Result correctness preserved — feature requests with zero votes still appear
- No changes required outside `src/db/requests.js`

**Tradeoffs:**
- JOIN with GROUP BY is more complex SQL than a simple SELECT — requires
  understanding of aggregate functions to maintain
- Performance advantage grows with data volume; at 10 rows the difference
  is negligible. The seed data made the cost visible
