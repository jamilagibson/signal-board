/**
 * Measurement capture script.
 * Reads server stdout line by line, identifies timedQuery log entries by their
 * JSON shape { query, duration_ms, rows }, and appends them to logs/measurements.json.
 *
 * Pass-through: every line is also written to stdout so server output remains
 * visible in the terminal while capture runs.
 *
 * Usage — pipe server output through this script:
 *   npm run dev 2>&1 | node scripts/capture-measurements.js
 *
 * @param {string} line - Each line of server stdout is tested against the timedQuery shape.
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const MEASUREMENTS_FILE = path.join(__dirname, '../logs/measurements.json');

const rl = readline.createInterface({ input: process.stdin });

rl.on('line', (line) => {
    // Pass every line through so the terminal still shows full server output
    process.stdout.write(line + '\n');

    try {
        const parsed = JSON.parse(line);

        // Match only lines that have the timedQuery shape: { query, duration_ms, rows }
        // Other JSON logs (e.g. requestLogger) are ignored
        if (
            parsed.query !== undefined &&
            parsed.duration_ms !== undefined &&
            parsed.rows !== undefined
        ) {
            const entry = {
                timestamp: new Date().toISOString(),
                day: null,
                test: '',
                query: parsed.query,
                duration_ms: parsed.duration_ms,
                rows: parsed.rows,
            };

            const existing = JSON.parse(fs.readFileSync(MEASUREMENTS_FILE, 'utf8'));
            existing.push(entry);
            fs.writeFileSync(MEASUREMENTS_FILE, JSON.stringify(existing, null, 2));
        }
    } catch {
        // Line is not JSON or does not match timedQuery shape — ignore
    }
});
