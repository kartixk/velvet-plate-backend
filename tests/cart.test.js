const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

let userToken;
let productId;
let branchId;
let userId;

beforeAll(async () => {
    await prisma.order.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});

    // Create Manager & Branch
    const managerHashed = await bcrypt.hash('managerpass', 10);
    const manager = await prisma.user.create({
        data: { email: 'cart_mgr@test.com', password: managerHashed, name: 'Cart Manager', phone: '9888888888', role: 'MANAGER', isVerified: true }
    });

    const branch = await prisma.branch.create({
        data: {
            name: 'Cart Main Branch',
            branchName: 'Cart Branch',
            city: 'Chennai',
            gstNumber: 'GSTINCART1',
            storeStatus: 'verified',
            isVisible: true,
            manager: { connect: { id: manager.id } }
        }
    });
    branchId = branch.id;

    // Create Customer
    const hashed = await bcrypt.hash('userpass', 10);
    const user = await prisma.user.create({
        data: { email: 'cartuser@test.com', password: hashed, name: 'Cart User', phone: '9777777777', role: 'CUSTOMER', isVerified: true }
    });
    userId = user.id;

    const login = await request(app).post('/api/auth/login').send({ email: 'cartuser@test.com', password: 'userpass' });
    userToken = login.headers['set-cookie'][0].split(';')[0].split('=')[1];

    // Create Product directly in DB for cart tests
    const product = await prisma.product.create({
        data: {
            name: 'Rasgulla',
            category: 'Desserts',
            price: 15,
            imageUrl: 'http://example.com/rasgulla.jpg',
            isAvailable: true,
            branchId: branch.id
        }
    });
    productId = product.id;
});

afterAll(async () => {
    await prisma.order.deleteMany({});
    await prisma.cart.deleteMany({});
    await prisma.product.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
});

describe('🛒 Cart API', () => {

    test('GET /api/cart - fetches empty cart initially', async () => {
        const res = await request(app)
            .get('/api/cart')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(200);
        expect(res.body.items).toEqual([]);
        expect(res.body.total).toBe(0);
    });

    test('POST /api/cart/items - adds new item to cart', async () => {
        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ productId, quantity: 5 });

        expect(res.status).toBe(200);
        expect(res.body.cart.items.length).toBe(1);
        expect(res.body.cart.items[0].productId).toBe(productId);
        expect(res.body.cart.items[0].quantity).toBe(5);
        expect(res.body.cart.total).toBe(15 * 5); // 75
    });

    test('POST /api/cart/items - adding duplicate item updates quantity in cart (upsert)', async () => {
        const res = await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ productId, quantity: 10 });

        expect(res.status).toBe(200);
        expect(res.body.cart.items.length).toBe(1);
        expect(res.body.cart.items[0].quantity).toBe(10);
        expect(res.body.cart.total).toBe(15 * 10); // 150
    });

    test('PUT /api/cart/items/:id - explicitly updates quantity', async () => {
        const res = await request(app)
            .put(`/api/cart/items/${productId}`)
            .set('Authorization', `Bearer ${userToken}`)
            .send({ quantity: 20 });

        expect(res.status).toBe(200);
        expect(res.body.cart.items[0].quantity).toBe(20);
        expect(res.body.cart.total).toBe(15 * 20); // 300
    });

    test('DELETE /api/cart/items/:id - removes item from cart', async () => {
        const res = await request(app)
            .delete(`/api/cart/items/${productId}`)
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(200);
        expect(res.body.cart.items.length).toBe(0);
        expect(res.body.cart.total).toBe(0);
    });

    test('POST /api/cart/confirm - fails on empty cart', async () => {
        const res = await request(app)
            .post('/api/cart/confirm')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ paymentMethod: 'CASH', branchId });

        expect(res.status).toBe(500); // or 400 when empty
    });

    test('POST /api/cart/confirm - successfully processes cart to order', async () => {
        // 1. Add item to cart
        await request(app)
            .post('/api/cart/items')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ productId, quantity: 10 });

        // 2. Confirm order
        const res = await request(app)
            .post('/api/cart/confirm')
            .set('Authorization', `Bearer ${userToken}`)
            .send({ paymentMethod: 'CASH', branchId });

        expect(res.status).toBe(201);
        expect(res.body.orderId).toBeDefined();

        // 3. Verify Cart is Empty
        const cart = await prisma.cart.findFirst({ where: { userId } });
        expect(cart.items.length).toBe(0);

        // 4. Verify Order Record Created
        const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
        expect(order).toBeTruthy();
        expect(order.paymentStatus).toBe('pending');
        expect(order.status).toBe('RECEIVED');
    });

});
