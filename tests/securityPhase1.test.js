const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { signToken, hashPassword } = require('../src/services/auth');

describe('🛡️ Security Remediation Phase 1 Regression Suite', () => {
    let customerUser, customerToken;
    let customerUser2, customerToken2;
    let managerUser1, managerToken1, branch1;
    let managerUser2, managerToken2, branch2;
    let adminUser, adminToken;
    let testProduct1, testProduct2;
    let testOrder1;

    beforeAll(async () => {
        // Clean database state
        await prisma.order.deleteMany({});
        await prisma.cart.deleteMany({});
        await prisma.branchItemStatus.deleteMany({});
        await prisma.product.deleteMany({});
        await prisma.branch.deleteMany({});
        await prisma.user.deleteMany({});

        const passwordHash = await hashPassword('SecurePass123!');

        // 1. Create Admin
        adminUser = await prisma.user.create({
            data: {
                email: 'admin_phase1@test.com',
                password: passwordHash,
                name: 'Admin User',
                phone: '9999999999',
                role: 'ADMIN',
                isVerified: true
            }
        });
        adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role });

        // 2. Create Manager 1 and Branch 1
        managerUser1 = await prisma.user.create({
            data: {
                email: 'manager1_phase1@test.com',
                password: passwordHash,
                name: 'Manager One',
                phone: '8888888881',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken1 = signToken({ id: managerUser1.id, email: managerUser1.email, role: managerUser1.role });

        branch1 = await prisma.branch.create({
            data: {
                name: 'Branch Alpha Phase 1',
                branchName: 'Alpha Store',
                city: 'Chennai',
                gstNumber: 'GSTIN001',
                storeStatus: 'verified',
                isVisible: true,
                managerId: managerUser1.id
            }
        });

        // 3. Create Manager 2 and Branch 2
        managerUser2 = await prisma.user.create({
            data: {
                email: 'manager2_phase1@test.com',
                password: passwordHash,
                name: 'Manager Two',
                phone: '8888888882',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken2 = signToken({ id: managerUser2.id, email: managerUser2.email, role: managerUser2.role });

        branch2 = await prisma.branch.create({
            data: {
                name: 'Branch Beta Phase 1',
                branchName: 'Beta Store',
                city: 'Bangalore',
                gstNumber: 'GSTIN002',
                storeStatus: 'verified',
                isVisible: true,
                managerId: managerUser2.id
            }
        });

        // 4. Create Customers
        customerUser = await prisma.user.create({
            data: {
                email: 'customer1_phase1@test.com',
                password: passwordHash,
                name: 'Customer One',
                phone: '7777777771',
                role: 'CUSTOMER',
                isVerified: true
            }
        });
        customerToken = signToken({ id: customerUser.id, email: customerUser.email, role: customerUser.role });

        customerUser2 = await prisma.user.create({
            data: {
                email: 'customer2_phase1@test.com',
                password: passwordHash,
                name: 'Customer Two',
                phone: '7777777772',
                role: 'CUSTOMER',
                isVerified: true
            }
        });
        customerToken2 = signToken({ id: customerUser2.id, email: customerUser2.email, role: customerUser2.role });

        // 5. Create Test Products
        testProduct1 = await prisma.product.create({
            data: {
                name: 'Gulab Jamun Alpha',
                price: 50,
                category: 'Traditional',
                imageUrl: 'https://example.com/jamun.jpg',
                isAvailable: true,
                branchId: branch1.id
            }
        });

        testProduct2 = await prisma.product.create({
            data: {
                name: 'Kaju Katli Beta',
                price: 100,
                category: 'Barfi',
                imageUrl: 'https://example.com/katli.jpg',
                isAvailable: true,
                branchId: branch2.id
            }
        });

        // 6. Create Test Order for Customer 1 at Branch 1
        testOrder1 = await prisma.order.create({
            data: {
                userId: customerUser.id,
                branchId: branch1.id,
                orderTotal: 118,
                orderType: 'DINE_IN',
                paymentMethod: 'CASH',
                paymentStatus: 'pending',
                status: 'RECEIVED',
                items: [{
                    productId: testProduct1.id,
                    productName: testProduct1.name,
                    price: 50,
                    quantity: 2,
                    totalPrice: 100
                }]
            }
        });
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

    // =========================================================================
    // 1. SEC-VULN-001: Registration Privilege Escalation Tests
    // =========================================================================
    describe('1. SEC-VULN-001: Public Registration Privilege Controls', () => {
        test('Registration with role ADMIN is rejected', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'hacker_admin@test.com',
                    password: 'Password123!',
                    name: 'Hacker',
                    phone: '9876543210',
                    role: 'ADMIN'
                });

            // Either Zod rejects with 400 (not in enum) or service rejects with 403
            expect([400, 403]).toContain(res.status);
            expect(res.body.token).toBeUndefined();

            // Verify user was NOT created as ADMIN in database
            const userInDb = await prisma.user.findUnique({ where: { email: 'hacker_admin@test.com' } });
            expect(userInDb).toBeNull();
        });

        test('Registration with role MANAGER creates unverified account with no login token', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'applicant_manager@test.com',
                    password: 'Password123!',
                    name: 'Applicant Manager',
                    phone: '9876543211',
                    role: 'MANAGER'
                });

            expect(res.status).toBe(201);
            expect(res.body.token).toBeNull();
            expect(res.body.user.isVerified).toBe(false);

            // Attempting to log in as unverified manager must be blocked
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'applicant_manager@test.com',
                    password: 'Password123!'
                });

            expect([400, 403]).toContain(loginRes.status);
            expect(loginRes.body.token).toBeUndefined();
        });

        test('Registration without role defaults safely to verified CUSTOMER with active token', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'regular_cust@test.com',
                    password: 'Password123!',
                    name: 'Regular Customer',
                    phone: '9876543212'
                });

            expect(res.status).toBe(201);
            expect(res.body.token).toBeDefined();
            expect(res.body.user.role).toBe('CUSTOMER');
            expect(res.body.user.isVerified).toBe(true);
        });
    });

    // =========================================================================
    // 2. SEC-VULN-002: Online Payment Verification Tests
    // =========================================================================
    describe('2. SEC-VULN-002: Online Payment Verification', () => {
        test('Orders submitted with UPI or CARD remain paymentStatus pending', async () => {
            // Set up a cart for customer 1
            await prisma.cart.upsert({
                where: { userId: customerUser.id },
                update: {
                    items: [{
                        productId: testProduct1.id,
                        productName: testProduct1.name,
                        price: 50,
                        quantity: 1
                    }],
                    total: 50
                },
                create: {
                    userId: customerUser.id,
                    items: [{
                        productId: testProduct1.id,
                        productName: testProduct1.name,
                        price: 50,
                        quantity: 1
                    }],
                    total: 50
                }
            });

            const res = await request(app)
                .post('/api/cart/confirm')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    paymentMethod: 'UPI',
                    branchId: branch1.id
                });

            expect(res.status).toBe(201);
            expect(res.body.orderId).toBeDefined();

            // Verify order in database is strictly PENDING, not PAID
            const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
            expect(order.paymentMethod).toBe('UPI');
            expect(order.paymentStatus).toBe('pending');
        });
    });

    // =========================================================================
    // 3. SEC-VULN-003: Product & Menu Role-Based Access Control Tests
    // =========================================================================
    describe('3. SEC-VULN-003: Product & Menu Mutation RBAC', () => {
        test('Customer cannot create a product (403 Forbidden)', async () => {
            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    name: 'Malicious Sweet',
                    price: 1,
                    category: 'Snacks',
                    imageUrl: 'https://example.com/bad.jpg'
                });

            expect(res.status).toBe(403);
        });

        test('Customer cannot update a product price or details (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/products/${testProduct1.id}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({
                    price: 0.01
                });

            expect(res.status).toBe(403);

            // Verify price remains untouched
            const product = await prisma.product.findUnique({ where: { id: testProduct1.id } });
            expect(product.price).toBe(50);
        });

        test('Customer cannot delete a product (403 Forbidden)', async () => {
            const res = await request(app)
                .delete(`/api/products/${testProduct1.id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(403);

            // Verify product still exists
            const product = await prisma.product.findUnique({ where: { id: testProduct1.id } });
            expect(product).not.toBeNull();
        });

        test('Manager cannot update a product belonging to another branch (403 Forbidden)', async () => {
            // Manager 1 (Branch Alpha) attempts to modify testProduct2 (Branch Beta)
            const res = await request(app)
                .put(`/api/products/${testProduct2.id}`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({
                    price: 999
                });

            expect(res.status).toBe(403);
        });

        test('Authorized Admin can successfully create a product (201 Created)', async () => {
            const res = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Admin Special Delight',
                    price: 120,
                    category: 'Premium',
                    imageUrl: 'https://example.com/delight.jpg'
                });

            expect(res.status).toBe(201);
            expect(res.body.name).toBe('Admin Special Delight');
        });
    });

    // =========================================================================
    // 4. SEC-VULN-004: Order Authorization & Status Transition Tests
    // =========================================================================
    describe('4. SEC-VULN-004: Order Ownership & Status Transitions', () => {
        test('Customer 2 cannot view Customer 1 order (403 Forbidden)', async () => {
            const res = await request(app)
                .get(`/api/orders/${testOrder1.id}`)
                .set('Authorization', `Bearer ${customerToken2}`);

            expect(res.status).toBe(403);
        });

        test('Customer 1 can view their own order (200 OK)', async () => {
            const res = await request(app)
                .get(`/api/orders/${testOrder1.id}`)
                .set('Authorization', `Bearer ${customerToken}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(testOrder1.id);
        });

        test('Customer cannot alter order status directly (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/orders/${testOrder1.id}/status`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ status: 'COMPLETED' });

            expect(res.status).toBe(403);
        });

        test('Manager of Branch Beta cannot modify order of Branch Alpha (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/orders/${testOrder1.id}/status`)
                .set('Authorization', `Bearer ${managerToken2}`)
                .send({ status: 'PREPARING' });

            expect(res.status).toBe(403);
        });

        test('Manager of Branch Alpha can transition status from RECEIVED to PREPARING (200 OK)', async () => {
            const res = await request(app)
                .put(`/api/orders/${testOrder1.id}/status`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ status: 'PREPARING' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PREPARING');
        });

        test('Invalid order status transition is rejected (400 Bad Request)', async () => {
            // Cannot jump from PREPARING to COMPLETED directly (must go to READY first)
            const res = await request(app)
                .put(`/api/orders/${testOrder1.id}/status`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ status: 'COMPLETED' });

            expect(res.status).toBe(400);
        });
    });
});
