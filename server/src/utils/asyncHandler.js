/** Express 5 forwards rejected promises to the error handler; kept for clarity in controllers. */
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
