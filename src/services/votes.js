const { createVote } = require('../db/votes');

/**
 * Records a vote from a user on a feature request.
 * Delegates persistence to the db layer and unwraps the created row.
 * If the user has already voted, the db layer throws a pg error with code 23505 —
 * this is intentionally not caught here and surfaces to the controller.
 *
 * @param {number} user_id - ID of the voting user.
 * @param {number} feature_request_id - ID of the feature request being voted on.
 * @returns {Promise<object>} The created vote row.
 */
const castVote = async (user_id, feature_request_id) => {
    const result = await createVote(user_id, feature_request_id);
    return result.rows[0];
};

module.exports = { castVote };
