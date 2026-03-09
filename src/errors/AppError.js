/**
 * Custom error class for intentional application errors.
 * Extends the built-in Error to carry statusCode and code alongside the message,
 * so the global error handler can build the correct HTTP response without
 * inspecting the error type in each controller.
 *
 * Usage: throw new AppError('Not found', 'NOT_FOUND', 404)
 *
 * @param {string} message - Human-readable error description
 * @param {string} code - Machine-readable error code (e.g. 'NOT_FOUND')
 * @param {number} statusCode - HTTP status code (e.g. 404)
 */
class AppError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}

module.exports = AppError;
