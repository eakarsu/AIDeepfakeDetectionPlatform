const rateLimit = require('express-rate-limit');
let ipKeyGenerator = null;
try { ({ ipKeyGenerator } = require('express-rate-limit')); } catch (_) { ipKeyGenerator = null; }

const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req, res) => {
    if (req.user) return `user:${req.user.id}`;
    if (typeof ipKeyGenerator === 'function') return ipKeyGenerator(req, res);
    return req.ip;
  },
  message: { error: 'AI rate limit exceeded. Max 20 requests/hour.' }
});

module.exports = { aiRateLimiter };
