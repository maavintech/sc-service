// Simple shared-secret guard — this service is only meant to be reached by
// DriveInnovate's backend, not the public internet.
function apiKeyAuth(req, res, next) {
  const expected = process.env.ULIP_SERVICE_API_KEY;
  const provided = req.headers['x-api-key'];
  if (!expected || provided !== expected) {
    return res.status(401).json({ success: false, message: 'Invalid or missing x-api-key' });
  }
  next();
}

module.exports = apiKeyAuth;
