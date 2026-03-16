/**
 * Request logging middleware.
 * Attaches a unique correlation ID to every request and logs structured timing
 * data when the response finishes. The correlation ID links request logs to
 * query logs, making it possible to trace a single request end-to-end in the terminal
 * — or in a log aggregator in production.
 *
 * Uses crypto.randomUUID() (Node 18+ built-in) instead of a uuid package —
 * no dependency needed when the runtime already provides it.
 *
 * Uses process.hrtime.bigint() for nanosecond-precision timing, converted to
 * milliseconds with 2 decimal places. More precise than Date.now(), which is
 * millisecond-only and subject to system clock adjustments.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
const requestLogger = (req, res, next) => {
    const requestId = crypto.randomUUID();
    const start = process.hrtime.bigint();
    // Capture originalUrl now — Express mutates req.url as it strips router mount
    // prefixes, so req.path read inside res.on('finish') would show '/' for every
    // routed request. req.originalUrl is set once and never touched again.
    const path = req.originalUrl;

    // Attach to req so downstream middleware and controllers can reference it
    req.requestId = requestId;

    // Send in response header so API callers can report it in bug reports
    res.setHeader('X-Request-Id', requestId);

    // 'finish' fires after the response is fully sent — captures total duration
    // including time spent in middleware, controllers, services, and db
    res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - start) / 1e6;
        console.log(JSON.stringify({
            requestId,
            method: req.method,
            path,
            status: res.statusCode,
            duration_ms: parseFloat(duration.toFixed(2)),
        }));
    });

    next();
};

module.exports = requestLogger;
