import request from 'supertest';

describe('Application E2E', () => {
  const baseUrl =
    process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

  it('GET /', async () => {
    await request(baseUrl)
      .get('/')
      .expect(200)
      .expect('Hot reload works automatically!');
  });

  it('GET /health', async () => {
    await request(baseUrl)
      .get('/health')
      .expect(200);
  });
});
