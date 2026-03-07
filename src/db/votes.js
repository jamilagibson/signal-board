const { timedQuery } = require('./pool');

/**
 * Inserts a vote record linking a user to a feature request.
 * The votes table has UNIQUE(user_id, feature_request_id), so a duplicate insert
 * will throw a pg error with code 23505 (unique_violation). This error is intentionally
 * not caught here — it surfaces to the controller, which owns the HTTP error response.
 *
 * @param {number} user_id - ID of the voting user.
 * @param {number} feature_request_id - ID of the feature request being voted on.
 * @returns {Promise<pg.QueryResult>} Raw pg result containing the inserted vote row.
 */
const createVote = async (user_id, feature_request_id) => {
    return await timedQuery(
        'INSERT INTO votes (user_id, feature_request_id) VALUES ($1, $2) RETURNING *',
        [user_id, feature_request_id]
    );
};

module.exports = { createVote };
