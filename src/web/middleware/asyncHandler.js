// Wraps an async GET-style route handler so a thrown ApiError reaches
// webErrorHandler (in app.js) as a rendered error page, instead of crashing.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
