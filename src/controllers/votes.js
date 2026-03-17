const { z } = require('zod');
const { castVote } = require('../services/votes');

const VoteSchema = z.object({
    user_id: z.number().int().positive(),
    feature_request_id: z.number().int().positive(),
});

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
    const result = VoteSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: z.flattenError(result.error),
        });
    }

    const { user_id, feature_request_id } = result.data;

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
