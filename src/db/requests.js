const { timedQuery } = require('./pool');

/**
 * Inserts a new feature request row into the database.
 * @param {string} title - The request title.
 * @param {string|undefined} description - Optional description; undefined becomes SQL NULL.
 * @param {string} status - One of 'open', 'in-progress', 'shipped'.
 * @param {number} user_id - ID of the submitting user.
 * @returns {Promise<pg.QueryResult>} Raw pg result — caller is responsible for unwrapping rows.
 */
const createRequest = async (title, description, status, user_id) => {
    return await timedQuery(
        'INSERT INTO feature_requests (title, description, status, user_id) VALUES ($1, $2, $3, $4) RETURNING *',
        [title, description, status, user_id]
    );
};

/**
 * Fetches all feature requests, then fires one COUNT query per request to get vote totals.
 *
 * N+1 ANTI-PATTERN — preserved intentionally for Day 3 diagnosis.
 *
 * Why this is an anti-pattern: for N feature requests, this function fires N+1 queries —
 * one SELECT to fetch all requests, then one COUNT per row. With 500 requests, that's 501
 * round trips to the database. In production this appears as a spike of near-identical
 * queries in slow query logs, often each fast individually but catastrophic in aggregate.
 * The fix (a single JOIN or subquery) is introduced on Day 3 after we've measured the cost.
 *
 * @returns {Promise<Array<object>>} Feature requests with a vote_count field appended.
 */
const getAllRequests = async () => {
    const requests = await timedQuery('SELECT * FROM feature_requests', []);

    const results = [];
    for (const request of requests.rows) {
        // N+1 ANTI-PATTERN — preserved intentionally for Day 3 diagnosis.
        // Each iteration fires a separate round trip to the database.
        const countResult = await timedQuery(
            'SELECT COUNT(*) FROM votes WHERE feature_request_id = $1',
            [request.id]
        );
        results.push({
            ...request,
            vote_count: parseInt(countResult.rows[0].count, 10),
        });
    }

    return results;
};

module.exports = { createRequest, getAllRequests };
