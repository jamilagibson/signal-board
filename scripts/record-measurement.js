/**
 * Manual measurement snapshot tool.
 * Appends a named summary entry to logs/measurements.json for documenting
 * before/after measurements during N+1 diagnosis and index optimization.
 *
 * In summary entries, duration_ms stores total elapsed time and rows stores
 * total query count — keeping the schema flat and consistent with captured entries.
 *
 * Usage:
 *   node scripts/record-measurement.js --day 3 --test "n1-before" --queries 501 --total_ms 847
 *
 * @param {string} --day      - Day number (e.g. 3)
 * @param {string} --test     - Snapshot label (e.g. "n1-before", "n1-after", "index-before")
 * @param {string} --queries  - Total number of queries fired
 * @param {string} --total_ms - Total elapsed time in milliseconds
 */

const fs = require('fs');
const path = require('path');

const MEASUREMENTS_FILE = path.join(__dirname, '../logs/measurements.json');

/**
 * Reads a named flag value from process.argv.
 * @param {string} flag - The flag name, e.g. '--day'
 * @returns {string|null} The value following the flag, or null if not found.
 */
const getArg = (flag) => {
    const idx = process.argv.indexOf(flag);
    return idx !== -1 ? process.argv[idx + 1] : null;
};

const day = parseInt(getArg('--day'), 10);
const test = getArg('--test');
const queries = parseInt(getArg('--queries'), 10);
const total_ms = parseFloat(getArg('--total_ms'));

if (!day || !test || !queries || !total_ms) {
    console.error('Usage: node scripts/record-measurement.js --day <n> --test <label> --queries <n> --total_ms <n>');
    process.exit(1);
}

const entry = {
    timestamp: new Date().toISOString(),
    day,
    test,
    query: 'summary',
    duration_ms: total_ms,
    rows: queries,
};

const existing = JSON.parse(fs.readFileSync(MEASUREMENTS_FILE, 'utf8'));
existing.push(entry);
fs.writeFileSync(MEASUREMENTS_FILE, JSON.stringify(existing, null, 2));

console.log(`Recorded: Day ${day} — ${test} (${queries} queries, ${total_ms}ms total)`);
