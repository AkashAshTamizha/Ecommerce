const request = require('supertest');
const app = require('../src/app');

describe('GET /health', () => {
  it('returns 200 with an ok status payload', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
    expect(res.body.uptime).toBeDefined();
  });
});

describe('Unknown routes', () => {
  it('returns 404 for a route that does not exist', async () => {
    const res = await request(app).get('/api/this-route-does-not-exist');
    expect(res.status).toBe(404);
  });
});
