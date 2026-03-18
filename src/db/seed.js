/**
 * Seed script — populates the database with realistic volume for performance testing.
 * Inserts 50 users, 500 feature requests, and 2000 votes using PostgreSQL's
 * generate_series for fast bulk inserts in a single query per table.
 *
 * Run once before Day 3 N+1 diagnosis and Day 4 index optimization.
 * Safe to re-run — ON CONFLICT DO NOTHING prevents duplicate key errors.
 *
 * Usage: node src/db/seed.js
 */

const { pool } = require('./pool');

const seed = async () => {
    console.log('Seeding users...');
    await pool.query(`
        INSERT INTO users (email)
        SELECT 'user' || i || '@example.com'
        FROM generate_series(1, 50) AS s(i)
        ON CONFLICT DO NOTHING
    `);

    console.log('Seeding feature requests...');
    await pool.query(`
        INSERT INTO feature_requests (title, description, user_id, status)
        SELECT
            'Feature request ' || i,
            'Description ' || i,
            (i % 50) + 1,
            CASE
                WHEN i % 3 = 0 THEN 'shipped'
                WHEN i % 3 = 1 THEN 'in-progress'
                ELSE 'open'
            END
        FROM generate_series(1, 500) AS s(i)
    `);

    console.log('Seeding votes...');
    await pool.query(`
        INSERT INTO votes (user_id, feature_request_id)
        SELECT (i % 50) + 1, (i % 500) + 1
        FROM generate_series(1, 2000) AS s(i)
        ON CONFLICT DO NOTHING
    `);

    console.log('Seed complete: 50 users, 500 feature requests, 2000 votes.');
};

seed()
    .catch((err) => {
        console.error('Seed failed:', err);
        process.exit(1);
    })
    .finally(() => pool.end());
