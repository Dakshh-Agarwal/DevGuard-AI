const { supabase } = require('./supabaseClient');
const logger = require('./logger');
const { setRequestUserId } = require('../middleware/requestContext');

async function verifyUserToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    logger.warn('Auth: missing token', {
      route: req.originalUrl,
      context: 'auth.verify',
    });
    return res.status(401).json({ error: 'Missing token' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    logger.warn('Auth: invalid token', {
      error: error?.message || 'No user data',
      route: req.originalUrl,
      context: 'auth.verify',
    });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = data.user;

  // Update AsyncLocalStorage with user_id for downstream logging
  setRequestUserId(data.user.id);

  logger.info('Auth: user verified', {
    user_id: data.user.id,
    route: req.originalUrl,
    context: 'auth.verify',
  });

  next();
}

// Add the missing getUserFromRequest function
async function getUserFromRequest(req) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) return null;

  // Update AsyncLocalStorage with user_id
  setRequestUserId(data.user.id);

  return data.user;
}

module.exports = { verifyUserToken, getUserFromRequest };
