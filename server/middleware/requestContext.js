// server/middleware/requestContext.js
// AsyncLocalStorage-based request context for request_id + user_id propagation
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const asyncLocalStorage = new AsyncLocalStorage();

/**
 * Express middleware that:
 * 1. Generates a UUID request_id for every incoming request
 * 2. Attaches it to req.requestId
 * 3. Sets X-Request-ID response header
 * 4. Stores { request_id, user_id } in AsyncLocalStorage for global access
 */
function requestContextMiddleware(req, res, next) {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();

  // Attach to request object for direct access
  req.requestId = requestId;

  // Set response header
  res.setHeader('X-Request-ID', requestId);

  // Run the rest of the request inside AsyncLocalStorage context
  const store = {
    request_id: requestId,
    user_id: null, // Will be populated after auth middleware runs
  };

  asyncLocalStorage.run(store, () => {
    next();
  });
}

/**
 * Update user_id in the current request context (call after auth middleware)
 */
function setRequestUserId(userId) {
  const store = asyncLocalStorage.getStore();
  if (store) {
    store.user_id = userId;
  }
}

/**
 * Get the current request context from AsyncLocalStorage
 * Returns { request_id, user_id } or null if outside request scope
 */
function getRequestContext() {
  return asyncLocalStorage.getStore() || null;
}

module.exports = {
  requestContextMiddleware,
  setRequestUserId,
  getRequestContext,
};
