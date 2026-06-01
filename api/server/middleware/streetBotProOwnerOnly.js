const jwt = require('jsonwebtoken');

const OWNER_EMAIL = (process.env.STREETBOT_PRO_OWNER_EMAIL || '').trim().toLowerCase();
const JWT_SECRET = process.env.JWT_SECRET || '';
const OWNER_ONLY_ENDPOINTS = new Set([]);

function isStreetBotPro(endpoint) {
  return OWNER_ONLY_ENDPOINTS.has((endpoint || '').trim().toLowerCase());
}

function getRequestEmail(req) {
  const directEmail = (req.user?.email || '').trim().toLowerCase();
  if (directEmail) {
    return directEmail;
  }

  const authHeader = req.headers?.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !JWT_SECRET) {
    return '';
  }

  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    return String(payload?.email || '').trim().toLowerCase();
  } catch {
    return '';
  }
}

function streetBotProOwnerOnly(req, res, next) {
  if (!OWNER_EMAIL) {
    return next();
  }

  const endpoint =
    req.params?.endpoint ?? req.body?.endpoint ?? req.body?.endpointOption?.endpoint ?? '';
  const userEmail = getRequestEmail(req);

  if (!isStreetBotPro(endpoint)) {
    return next();
  }

  if (userEmail === OWNER_EMAIL) {
    return next();
  }

  return res.status(403).json({ error: 'Forbidden', message: 'Street Bot Pro and specialist agents are owner-only.' });
}

module.exports = { streetBotProOwnerOnly, isStreetBotPro, OWNER_EMAIL, getRequestEmail };
