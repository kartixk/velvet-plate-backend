const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

afterAll(async () => {
  await prisma.$disconnect();
});

describe('🩺 Health and Readiness API Checks', () => {
  test('GET /api/health returns 200 and ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('Velvet Plate API');
  });

  test('GET /api/health/ready returns 200 and connected database status', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.database).toBe('connected');
  });
});
