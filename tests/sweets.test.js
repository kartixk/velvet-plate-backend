const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

let adminToken;
let userToken;
let sweetId;

beforeAll(async () => {
  await prisma.order.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.branchItemStatus.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.user.deleteMany({});

  // Setup Admin
  const adminHashed = await bcrypt.hash('adminpass', 10);
  const admin = await prisma.user.create({
    data: { email: 'admin@test.com', password: adminHashed, name: 'Admin', role: 'ADMIN', phone: '9999999990' }
  });

  const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin@test.com', password: 'adminpass' });
  adminToken = adminLogin.headers['set-cookie'][0].split(';')[0].split('=')[1];

  // Setup Branch
  await prisma.branch.create({
    data: {
      name: 'Main Branch',
      branchName: 'Main Store',
      location: '123 Sweet Street',
      city: 'Mumbai',
      phone: '9999999999',
      gstNumber: '29ABCDE1234F1Z5',
      storeStatus: 'verified',
      isVisible: true,
      manager: { connect: { id: admin.id } }
    }
  });

  // Setup Regular User
  const userHashed = await bcrypt.hash('userpass', 10);
  await prisma.user.create({
    data: { email: 'user@test.com', password: userHashed, name: 'User', role: 'CUSTOMER', phone: '9999999991' }
  });

  const userLogin = await request(app).post('/api/auth/login').send({ email: 'user@test.com', password: 'userpass' });
  userToken = userLogin.headers['set-cookie'][0].split(';')[0].split('=')[1];
});

afterAll(async () => {
  await prisma.order.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.branchItemStatus.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.$disconnect();
});

describe('🍬 Products / Sweets API - Comprehensive', () => {

  test('Regular USER cannot create a sweet', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Illegal Sweet',
        category: 'Milk',
        price: 50,
        imageUrl: 'http://example.com/sweet.jpg'
      });

    expect(res.status).toBe(403);
    expect(res.body.error || res.body.message).toMatch(/Forbidden|Staff access required/i);
  });

  test('ADMIN POST /api/products - create sweet', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Gulab Jamun',
        category: 'Milk',
        price: 50,
        imageUrl: 'http://example.com/gulab.jpg'
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Gulab Jamun');
    sweetId = res.body._id || res.body.id;
  });

  test('ADMIN POST /api/products - upsert existing sweet with id updates it', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        id: sweetId,
        name: 'Gulab Jamun',
        category: 'Milk',
        price: 60,
        imageUrl: 'http://example.com/gulab.jpg'
      });

    expect(res.status).toBe(201);
    expect(res.body.price).toBe(60);
  });

  test('GET /api/products - list sweets', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Gulab Jamun');
  });

  test('ADMIN PUT /api/products/:id - edit sweet', async () => {
    const res = await request(app)
      .put(`/api/products/${sweetId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 70 });

    expect(res.status).toBe(200);
    expect(res.body.price).toBe(70);
  });

  test('POST /api/products/:id/purchase - purchase sweet successfully', async () => {
    const res = await request(app)
      .post(`/api/products/${sweetId}/purchase`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 5 });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/Successfully purchased 5/i);

    const orders = await prisma.order.findMany({});
    expect(orders.length).toBeGreaterThan(0);
  });

  test('POST /api/products/:id/purchase - unavailable sweet returns error', async () => {
    // Set availability to false
    await prisma.product.update({
      where: { id: sweetId },
      data: { isAvailable: false }
    });

    const res = await request(app)
      .post(`/api/products/${sweetId}/purchase`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 2 });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('ADMIN POST /api/products/:id/restock', async () => {
    const res = await request(app)
      .post(`/api/products/${sweetId}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 10 });

    expect(res.status).toBe(200);
    const updated = await prisma.product.findUnique({ where: { id: sweetId } });
    expect(updated.isAvailable).toBe(true);
  });

  test('USER POST /api/products/:id/restock - access denied', async () => {
    const res = await request(app)
      .post(`/api/products/${sweetId}/restock`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 10 });

    expect(res.status).toBe(403);
  });

  test('USER DELETE /api/products/:id - access denied', async () => {
    const res = await request(app)
      .delete(`/api/products/${sweetId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  test('ADMIN DELETE /api/products/:id - works', async () => {
    const res = await request(app)
      .delete(`/api/products/${sweetId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const check = await prisma.product.findUnique({ where: { id: sweetId } });
    expect(check).toBeNull();
  });
});
