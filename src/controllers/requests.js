const { z } = require('zod');
const { submitRequest, fetchRequests, invalidateCache } = require('../services/requests');

/**
 * Zod schema for POST /requests.
 *
 * Shift-left principle: validation fires here, at the HTTP boundary, before any service
 * or database logic runs. If the request is malformed, it never reaches the db layer.
 * This is the earliest possible point to reject bad input — catching the problem at the
 * source rather than letting it propagate inward and fail with a cryptic database error.
 */
const RequestSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    status: z.enum(['open', 'in-progress', 'shipped']).default('open'),
    user_id: z.number().int().positive(),
});

/**
 * POST /requests
 * Validates the request body with Zod, then delegates to the service layer.
 * Returns 400 with structured validation errors if the body is invalid.
 * Returns 201 with the created request on success.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const postRequest = async (req, res, next) => {
    const parsed = RequestSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: 'Validation failed',
            code: 'VALIDATION_ERROR',
            details: z.flattenError(parsed.error),
        });
    }

    try {
        const request = await submitRequest(parsed.data);
        await invalidateCache();
        res.status(201).json(request);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /requests
 * Returns all feature requests with vote counts.
 * No validation needed — this is a read with no input parameters.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const getRequests = async (req, res, next) => {
    try {
        const requests = await fetchRequests(req.requestId);
        res.status(200).json(requests);
    } catch (err) {
        next(err);
    }
};

module.exports = { postRequest, getRequests };
