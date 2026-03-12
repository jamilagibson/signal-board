# ADR-006: Redis Caching for GET /requests

**Date:** 2026-03-12
**Status:** Accepted
**Branch:** feature/redis-cache

---

## Context

After the N+1 fix (ADR-003) and indexing (ADR-004), `GET /requests` still hit
the database on every request. With 509 rows and a LEFT JOIN aggregating vote
counts, the query runs in ~54ms — fast, but unnecessarily repeated for reads
that return identical data between writes.

The access pattern is read-heavy: many callers read the feature request list
for every one that casts a vote. This makes it a strong candidate for
application-layer caching.

---

## Measured Impact

| | Duration |
|---|---|
| Cache miss (database hit) | ~221ms |
| Cache hit (Redis) | ~7ms |

**~32x faster on cache hits. Zero database queries served from cache.**

First-hit latency (~156ms) is higher due to lazy Redis connection establishment
on the initial read. Steady-state hits (requests 3+) settle at 4–10ms.

---

## Decision

Cache the `GET /requests` response in Redis using the cache-aside pattern with
a 60-second TTL and explicit invalidation on writes.

**Cache-aside pattern:** the application checks Redis before querying the
database. On a miss it queries the database and writes the result to Redis. On
a hit it returns the cached value directly.

**Cache key:** `feature_requests`

**TTL:** 60 seconds — vote counts don't need to be real-time. A one-minute lag
is acceptable for a feature request board and bounds worst-case stale data
without requiring any write to trigger invalidation.

**Explicit invalidation:** `POST /requests` and `POST /votes` both call
`redis.del('feature_requests')` after a successful write, so the cache never
serves stale data after a mutation.

---

## Alternatives Considered

**In-memory cache (Node.js Map):**
Simpler — no additional dependency or infrastructure. But state is lost on
server restart, not shareable across multiple Node processes, and has no native
TTL support. Ruled out for production viability.

**TTL-only invalidation (no explicit delete on writes):**
Simpler write path, but allows up to 60 seconds of stale data after a vote or
new request. Explicit invalidation was preferred since the write events are
known and the implementation is straightforward.

---

## Consequences

**Positive:**
- ~32x response time improvement on cache hits
- Database load reduced proportionally to cache hit rate
- Graceful degradation: Redis errors are caught and logged; the request falls
  through to the database rather than returning a 500
- Cache behavior is observable in server logs (`redis_cache_miss`,
  `redis_cache_write_fail` events)

**Tradeoffs:**
- Adds Redis as an operational dependency — the server degrades gracefully
  without it, but Redis must be running for cache hits to occur
- `JSON.stringify` / `JSON.parse` on 509 rows adds overhead on the miss path
  (~167ms above the raw query time of 54ms)
- First cache hit carries lazy-connection overhead (~156ms); steady state
  is 4–10ms

**What this taught me:**
The right answer isn't always optimizing the query — sometimes it's not hitting
the database at all. The instrumentation built on Day 2 (`timedQuery`,
`requestLogger`) made it possible to isolate exactly where time was being spent
and confirm the cache was working before citing any numbers.
