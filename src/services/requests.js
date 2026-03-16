const { createRequest, getAllRequests } = require('../db/requests');
const redis = require('../db/redisClient');

const CACHE_KEY = 'feature_requests';
const CACHE_TTL = 60; // seconds

/**
 * Submits a new feature request.
 * Delegates persistence to the db layer and unwraps the created row from the raw pg result.
 * This layer owns the business operation — the db layer only knows SQL.
 *
 * @param {object} params
 * @param {string} params.title
 * @param {string|undefined} params.description
 * @param {string} params.status
 * @param {number} params.user_id
 * @returns {Promise<object>} The created feature_request row.
 */
const submitRequest = async ({ title, description, status, user_id }) => {
    const result = await createRequest(title, description, status, user_id);
    return result.rows[0];
};

/**
 * Retrieves all feature requests with vote counts.
 * Delegates to the db layer, which fires one query per request (N+1 — see db/requests.js).
 * The service returns plain data — no knowledge of req, res, or HTTP status codes.
 *
 * @returns {Promise<Array<object>>} All feature requests with vote_count appended.
 */
const fetchRequests = async (requestId) => {
    try {
        const cached = await redis.get(CACHE_KEY);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.error({ event: 'redis_cache_miss', requestId, message: err.message });
    }

    const rows = await getAllRequests();

    try {
        await redis.set(CACHE_KEY, JSON.stringify(rows), 'EX', CACHE_TTL);
    } catch (err) {
        console.error({ event: 'redis_cache_write_fail', requestId, message: err.message });
    }

    return rows;
};

const invalidateCache = async () => {
    try {
        await redis.del(CACHE_KEY);
    } catch (err) {
        console.error({ event: 'redis_invalidate_fail', message: err.message });
    }
};

module.exports = { submitRequest, fetchRequests, invalidateCache };
