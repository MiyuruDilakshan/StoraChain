const jwt = require('jsonwebtoken');

module.exports = function authMiddleware(req, res, next) {
  // Standard Bearer token from Authorization header
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  // Fallback: allow token via query param for SSE connections (EventSource can't set headers)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, role }
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid' });
  }
};
