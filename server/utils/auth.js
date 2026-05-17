const { supabase } = require('./supabaseClient');

async function verifyUserToken(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.user = data.user;
  next();
}

// Add the missing getUserFromRequest function
async function getUserFromRequest(req) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  
  if (error || !data?.user) return null;
  
  return data.user;
}

module.exports = { verifyUserToken, getUserFromRequest };
