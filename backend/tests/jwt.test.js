const jwt = require('jsonwebtoken');

// jwt.js reads these env vars at module-load time, so they must be set
// before it is required below (a beforeAll hook would run too late).
process.env.JWT_ACCESS_SECRET = 'test-access-secret-do-not-use-in-production';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-do-not-use-in-production';
process.env.JWT_ACCESS_EXPIRY = '15m';
process.env.JWT_REFRESH_EXPIRY = '7d';

const {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} = require('../src/utils/jwt');

describe('signAccessToken / verifyAccessToken', () => {
  it('produces a JWT that decodes back to the given payload', () => {
    const token = signAccessToken({ id: '64f0000000000000000000ab' });
    const decoded = verifyAccessToken(token);

    expect(decoded.id).toBe('64f0000000000000000000ab');
    expect(decoded.exp).toBeDefined();
  });

  it('rejects a token signed with a different secret', () => {
    const bogusToken = jwt.sign({ id: 'someUserId' }, 'wrong-secret');

    expect(() => verifyAccessToken(bogusToken)).toThrow();
  });
});

describe('signRefreshToken / verifyRefreshToken', () => {
  it('produces a JWT that decodes back to the given payload', () => {
    const token = signRefreshToken({ id: '64f0000000000000000000ab' });
    const decoded = verifyRefreshToken(token);

    expect(decoded.id).toBe('64f0000000000000000000ab');
    expect(decoded.exp).toBeDefined();
  });

  it('an access token cannot be verified as a refresh token', () => {
    const accessToken = signAccessToken({ id: 'someUserId' });

    expect(() => verifyRefreshToken(accessToken)).toThrow();
  });
});
