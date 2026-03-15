const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const timedQuery = async (text, params) => {
    const start = Date.now();

    const result = await pool.query(text, params);

    const duration = Date.now() - start;

    console.log(JSON.stringify({
        query: text.substring(0,80),
        duration_ms: duration,
        rows: result.rowCount
    }));

    return result;
};

//to prevent silent crashes if the database connection fails
pool.on('error', (err) => {
    console.error('Unexpected database error:', err);
});

module.exports = { pool, timedQuery };