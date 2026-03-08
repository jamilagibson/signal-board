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
 * Fetches all feature requests with vote counts in a single query.
 * Replaces the N+1 loop diagnosed on Day 3.
 *
 * LEFT JOIN ensures feature requests with zero votes are included.
 * GROUP BY feature_requests.id aggregates one vote_count per request.
 *
 * Day 3 before: 501 queries, ~5856ms
 * Day 3 after:  1 query, ~263ms
 *
 * @returns {Promise<Array<object>>} Feature requests with vote_count appended.
 */
const getAllRequests = async () => {
    const result = await timedQuery(
        `SELECT feature_requests.*,
                COUNT(votes.id)::int AS vote_count
         FROM feature_requests
         LEFT JOIN votes ON votes.feature_request_id = feature_requests.id
         GROUP BY feature_requests.id
         ORDER BY feature_requests.id`,
        []
    );

    return result.rows;
};

module.exports = { createRequest, getAllRequests };
