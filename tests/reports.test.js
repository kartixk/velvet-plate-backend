const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const prisma = require('../src/prismaClient');

let adminToken;
let userToken;

beforeAll(async () => {
    await prisma.order.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});

    // Admin Setup
    const adminHashed = await bcrypt.hash('adminpass', 10);
    const admin = await prisma.user.create({
        data: { email: 'admin_reports@test.com', password: adminHashed, name: 'Admin', phone: '9999999990', role: 'ADMIN', isVerified: true }
    });
    const adminLogin = await request(app).post('/api/auth/login').send({ email: 'admin_reports@test.com', password: 'adminpass' });
    adminToken = adminLogin.headers['set-cookie'][0].split(';')[0].split('=')[1];

    // Branch Setup
    const branch = await prisma.branch.create({
        data: {
            name: 'Reports Main Branch',
            branchName: 'Reports Store',
            city: 'Chennai',
            gstNumber: 'GSTINREP1',
            storeStatus: 'verified',
            isVisible: true,
            manager: { connect: { id: admin.id } }
        }
    });

    // Regular User Setup
    const userHashed = await bcrypt.hash('userpass', 10);
    const user = await prisma.user.create({
        data: { email: 'user_reports@test.com', password: userHashed, name: 'User', phone: '9999999991', role: 'CUSTOMER', isVerified: true }
    });
    const userLogin = await request(app).post('/api/auth/login').send({ email: 'user_reports@test.com', password: 'userpass' });
    userToken = userLogin.headers['set-cookie'][0].split(';')[0].split('=')[1];

    // Create Mock Orders Data
    await prisma.order.create({
        data: {
            user: { connect: { id: user.id } },
            branch: { connect: { id: branch.id } },
            orderTotal: 100,
            status: 'COMPLETED',
            orderType: 'DINE_IN',
            paymentMethod: 'CASH',
            paymentStatus: 'paid',
            items: [{ productId: '65f123456789012345678901', productName: 'Ladoo', price: 10, quantity: 10, totalPrice: 100 }],
            createdAt: new Date() // Today
        }
    });

    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 2); // 2 months ago

    await prisma.order.create({
        data: {
            user: { connect: { id: user.id } },
            branch: { connect: { id: branch.id } },
            orderTotal: 50,
            status: 'COMPLETED',
            orderType: 'TAKEAWAY',
            paymentMethod: 'CASH',
            paymentStatus: 'paid',
            items: [{ productId: '65f123456789012345678902', productName: 'Barfi', price: 50, quantity: 1, totalPrice: 50 }],
            createdAt: lastMonth
        }
    });
});

afterAll(async () => {
    await prisma.order.deleteMany({});
    await prisma.branch.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.$disconnect();
});

describe('📊 Reports API', () => {

    test('NON-ADMIN GET /api/reports/sales - access denied', async () => {
        const res = await request(app)
            .get('/api/reports/sales')
            .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
    });

    test('ADMIN GET /api/reports/sales?type=all - fetches all sales', async () => {
        const res = await request(app)
            .get('/api/reports/sales?type=all')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(2);
        expect(res.body.totalAmount).toBe(150); // 100 + 50
        expect(res.body.sales.length).toBe(2);
    });

    test('ADMIN GET /api/reports/sales?type=day - fetches only today sales', async () => {
        const res = await request(app)
            .get('/api/reports/sales?type=day')
            .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        // Should only grab the 1 sale from today (100 total)
        expect(res.body.count).toBe(1);
        expect(res.body.totalAmount).toBe(100);
    });

});
