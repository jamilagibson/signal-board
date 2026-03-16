const AppError = require('../errors/AppError');

/**
 * Global error handling middleware.
 * Must be registered in app.js after all routes — Express identifies error handlers
 * by their 4-argument signature (err, req, res, next).
 *
 * Distinguishes between intentional AppErrors (safe to expose to the client)
 * and unexpected runtime errors (message is logged server-side, generic response
 * sent to client to prevent information leakage).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const errorHandler = (err, req, res, _next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
            error: err.message,
            code: err.code,
        });
    }

    // Unexpected error — log internally, send generic response to client
    console.error({
        requestId: req.requestId,
        error: err.message,
        stack: err.stack,
    });

    res.status(500).json({
        error: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
    });
};

module.exports = errorHandler;
