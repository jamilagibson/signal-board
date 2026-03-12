/**
 * Measurement capture script.
 * Reads server stdout line by line and appends matching entries to
 * logs/measurements.json. Captures two log shapes:
 *
 *   timedQuery  { query, duration_ms, rows }
 *     → raw DB query entries, labelled with day: null / test: ''
 *
 *   requestLogger  { method, path, status, duration_ms }  (GET /requests, 200)
 *     → labelled as 'redis-miss' if a DB query fired for that request,
 *       or 'redis-hit' if Redis served it without touching the database.
 *       Detection: a timedQuery line always arrives before its requestLogger
 *       line (the DB query completes before the response is sent), so tracking
 *       a dbQueryFired flag between requestLogger events is sufficient.
 *
 * Pass-through: every line is also written to stdout so server output remains
 * visible in the terminal while capture runs.
 *
 * Usage — pipe server output through this script:
 *   npm run dev 2>&1 | node scripts/capture-measurements.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const MEASUREMENTS_FILE = path.join(__dirname, '../logs/measurements.json');
const REDIS_DAY = 6;

const rl = readline.createInterface({ input: process.stdin });

// True if a timedQuery line has arrived since the last GET /requests response.
// A DB query means the request was a cache miss; no DB query means a cache hit.
let dbQueryFired = false;

const append = (entry) => {
    const existing = JSON.parse(fs.readFileSync(MEASUREMENTS_FILE, 'utf8'));
    existing.push(entry);
    fs.writeFileSync(MEASUREMENTS_FILE, JSON.stringify(existing, null, 2));
};

rl.on('line', (line) => {
    // Pass every line through so the terminal still shows full server output
    process.stdout.write(line + '\n');

    try {
        const parsed = JSON.parse(line);

        // timedQuery shape: { query, duration_ms, rows }
        if (
            parsed.query !== undefined &&
            parsed.duration_ms !== undefined &&
            parsed.rows !== undefined
        ) {
            dbQueryFired = true;
            append({
                timestamp: new Date().toISOString(),
                day: null,
                test: '',
                query: parsed.query,
                duration_ms: parsed.duration_ms,
                rows: parsed.rows,
            });
        }

        // requestLogger shape for GET /requests 200 responses
        if (parsed.method === 'GET' && parsed.path === '/requests' && parsed.status === 200) {
            const test = dbQueryFired ? 'redis-miss' : 'redis-hit';
            dbQueryFired = false;
            append({
                timestamp: new Date().toISOString(),
                day: REDIS_DAY,
                test,
                query: 'summary',
                duration_ms: parsed.duration_ms,
                rows: 1,
            });
        }
    } catch {
        // Line is not JSON or does not match a shape we care about — ignore
    }
});
