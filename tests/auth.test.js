const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

beforeAll(async () => {
  await prisma.cart.deleteMany({});
  await prisma.user.deleteMany({});
});

afterAll(async () => {
  await prisma.cart.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe('🔐 Auth API', () => {
  test('register -> login works on happy path', async () => {
    // Register
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@test.com',
        password: 'pass123',
        name: 'Test User',
        phone: '9876543210'
      });

    expect(reg.status).toBe(201);
    expect(reg.headers['set-cookie'][0]).toMatch(/token=/);

    // Login
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'pass123'
      });

    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'][0]).toMatch(/token=/);
    expect(login.body.user.email).toBe('test@test.com');
  });

  test('registering with an already existing email returns 400', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@test.com',
        password: 'newpassword123',
        name: 'Duplicate User',
        phone: '9876543211'
      });

    expect(reg.status).toBe(400);
    expect(reg.body.error).toMatch(/Email already/i);
  });

  test('login with incorrect password returns 400 or 401', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@test.com',
        password: 'wrongpassword'
      });

    expect([400, 401]).toContain(login.status);
    expect(login.body.error).toMatch(/Invalid email or password|Invalid credentials/i);
  });

  test('login with non-existent email returns 400 or 401', async () => {
    const login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nobody@test.com',
        password: 'pass123'
      });

    expect([400, 401]).toContain(login.status);
    expect(login.body.error).toMatch(/Invalid email or password|Invalid credentials/i);
  });

  test('accessing protected route without token returns 401', async () => {
    const res = await request(app)
      .get('/api/cart');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Authorization required/i);
  });

  test('accessing protected route with invalid token returns 403 or 401', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/Invalid or expired token/i);
  });
});
