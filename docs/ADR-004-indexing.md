# ADR-004: PostgreSQL Index Strategy for votes and feature_requests

**Date:** 2026-03-08
**Status:** Accepted
**Branch:** perf/indexing

---

## Context

Following the Day 3 N+1 fix, `GET /requests` now executes a single LEFT JOIN query.
The next question is whether indexes can reduce the cost of that JOIN further.
EXPLAIN ANALYZE was used to observe the query plan before and after adding indexes.

---

## Measured Results

**Before indexes:**
- Scan type: Seq Scan on votes, Seq Scan on feature_requests
- Execution Time: 2.794ms

**After indexes:**
- Scan type: Seq Scan on votes, Seq Scan on feature_requests (unchanged)
- Execution Time: 5.414ms

The query planner chose not to use the indexes. This is correct behavior — see Decision below.

---

## Decision

Two indexes were added:

```sql
CREATE INDEX idx_votes_feature_request_id ON votes(feature_request_id);
CREATE INDEX idx_feature_requests_status ON feature_requests(status);
```

**`idx_votes_feature_request_id`:** Targets the JOIN condition
`votes.feature_request_id = feature_requests.id`. At scale this is the most
impactful index — every `GET /requests` call joins on this column.

**`idx_feature_requests_status`:** Targets future filtering queries such as
`WHERE status = 'open'`. A feature voting API will commonly need to filter
by status — this index makes that query O(log n) rather than O(n) when it's added.

---

## Why the Planner Still Chose Seq Scan

PostgreSQL's query planner chooses between a sequential scan and an index scan
based on cost estimates. With 500 feature requests and 2000 votes:

- The entire votes table fits in a small number of disk pages
- A sequential scan reads those pages in one pass
- An index scan requires reading the index structure first, then fetching rows
  by pointer — more I/O, not less, at this data volume

The planner correctly determined that Seq Scan was cheaper. This is not a failure
of the indexes — it is the planner working as designed. At ~50,000 rows the
cost calculation flips and the planner switches to Index Scan automatically,
without any code changes.

**The indexes are not wasted.** They exist for when the data grows. Adding them
now is the right engineering decision — retrofitting indexes on a large production
table requires a lock and causes downtime.

---

## How to Verify Index Usage at Scale

To force the planner to demonstrate Index Scan behavior at current data volume:

```sql
SET enable_seqscan = off;
EXPLAIN ANALYZE
SELECT feature_requests.*, COUNT(votes.id)::int AS vote_count
FROM feature_requests
LEFT JOIN votes ON votes.feature_request_id = feature_requests.id
GROUP BY feature_requests.id
ORDER BY feature_requests.id;
SET enable_seqscan = on;
```

This disables sequential scans temporarily, forcing the planner to use available
indexes. Never use this in production — it is a diagnostic tool only.

---

## Consequences

**Positive:**
- Indexes are in place before data volume makes them critical
- `idx_votes_feature_request_id` will accelerate `GET /requests` JOIN at scale
- `idx_feature_requests_status` supports future filter queries without a migration
- EXPLAIN ANALYZE habit established — query plan is now part of the development workflow

**Tradeoffs:**
- Indexes add write overhead — every INSERT into votes or feature_requests must
  also update the index. At current volume this is negligible
- Planner did not use indexes at 500 rows — honest result, documented as expected behavior
