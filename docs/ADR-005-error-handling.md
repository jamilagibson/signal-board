# ADR-005: AppError Class and Centralized Error Handling

## Status
Accepted

## Context

Before Day 5, error handling was inconsistent across controllers. The votes controller caught `23505` (unique_violation) inline and returned a hardcoded JSON shape. The requests controller had no explicit error handling at all. Any unhandled exception would propagate to Express, which in development mode returns an HTML error page — not useful for a JSON API and confusing for API consumers who expect `{ error, code }` on every response.

Two failure modes needed addressing:
1. **Intentional errors** — violations of business rules (duplicate vote, validation failure) that should produce specific HTTP status codes and machine-readable codes
2. **Unexpected errors** — runtime failures that should be logged server-side but never leak implementation details to the client

## Decision

### AppError Class

A custom `AppError` extends the built-in `Error` to carry `statusCode` and `code` alongside `message`. Controllers throw `AppError` for intentional failures; the global handler catches them and builds the response from those fields.

```js
class AppError extends Error {
    constructor(message, code, statusCode) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.name = 'AppError';
    }
}
```

`super(message)` must be called before accessing `this` in a derived class — this is a JavaScript class semantics requirement, not a style preference.

### Centralized Error Handler Middleware

A single Express error handler registered after all routes handles every unhandled error. Express identifies error-handling middleware by its 4-argument signature `(err, req, res, next)`.

```js
const errorHandler = (err, req, res, _next) => {
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ error: err.message, code: err.code });
    }
    console.error({ requestId: req.requestId, error: err.message, stack: err.stack });
    res.status(500).json({ error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' });
};
```

The `_next` parameter is unused but required — Express uses function arity to classify middleware, so omitting it would silently demote the handler to a regular middleware and errors would go unhandled.

**Information leakage prevention:** `AppError` messages are authored by us and safe to surface. For all other errors, the raw `err.message` is logged server-side (correlated with `requestId`) but never sent to the client. The client receives only `'An unexpected error occurred'`.

### Registration Order

```js
app.use(requestLogger);
app.use('/users', usersRouter);
app.use('/requests', requestsRouter);
app.use('/votes', votesRouter);
app.use(errorHandler);  // must be last
```

Express processes middleware sequentially. The error handler must be registered after all routes so it can catch errors propagated via `next(err)` from any route.

## Votes Controller Tradeoff

The votes controller catches PostgreSQL error code `23505` (unique_violation) inline rather than rethrowing as an `AppError`:

```js
if (err.code === '23505') {
    return res.status(409).json({ error: 'Already voted', code: 'DUPLICATE_VOTE' });
}
```

This is an intentional, documented tradeoff. Refactoring to `throw new AppError(...)` would require the db layer to interpret PostgreSQL-specific error codes — mixing persistence concerns with application error semantics. The inline catch is layer-appropriate: the controller is the right place to map a database constraint violation to an HTTP response. The tradeoff is that the error shape for this case is constructed manually rather than flowing through the centralized handler, which means it could diverge from the standard shape if the response format changes. This is acceptable at current scale and would be revisited if the error surface grows.

## Consequences

- Every response across all endpoints now conforms to `{ error, code }` — API consumers never encounter an unstructured HTML error page
- Unexpected errors are logged with the correlation `requestId` so they can be traced in server logs
- Controllers that encounter intentional failures throw `AppError` and stay single-purpose — no inline response construction needed
- The votes controller inline catch is the one documented exception to this pattern
