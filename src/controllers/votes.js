const { castVote } = require('../services/votes');

/**
 * POST /votes
 * Records a vote for a feature request.
 *
 * Error handling is explicit here rather than delegating to next(err), because
 * each failure mode has a specific HTTP response shape that belongs to this layer.
 *
 * PostgreSQL error code 23505 is a unique_violation — triggered when an INSERT
 * violates a UNIQUE constraint. The votes table has UNIQUE(user_id, feature_request_id),
 * so a duplicate vote produces this error. 409 Conflict is the correct HTTP status
 * because the request itself is valid, but it conflicts with existing state on the server.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
const postVote = async (req, res) => {
    const { user_id, feature_request_id } = req.body;

    try {
        const vote = await castVote(user_id, feature_request_id);
        res.status(201).json(vote);
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({
                error: 'Already voted',
                code: 'DUPLICATE_VOTE',
            });
        }
        res.status(500).json({
            error: err.message,
            code: 'INTERNAL_ERROR',
        });
    }
};

module.exports = { postVote };
