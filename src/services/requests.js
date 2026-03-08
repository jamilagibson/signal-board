const { createRequest, getAllRequests } = require('../db/requests');

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
const fetchRequests = async () => {
    return await getAllRequests();
};

module.exports = { submitRequest, fetchRequests };
