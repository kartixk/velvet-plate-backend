const request = require('supertest');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { signToken, hashPassword } = require('../src/services/auth');

describe('🔍 Phase 2: Security Fix Verification Suite', () => {
    let adminUser, adminToken;
    let manager1, managerToken1, branch1;
    let manager2, managerToken2, branch2;
    let customerA, customerTokenA;
    let customerB, customerTokenB;
    let productA, productB;
    let orderA, orderB;

    // Targeted list of test user emails to clean
    const testUserEmails = [
        'phase2_admin@test.com',
        'phase2_mgr1@test.com',
        'phase2_mgr2@test.com',
        'phase2_custA@test.com',
        'phase2_custB@test.com',
        'rogue_admin@test.com',
        'applicant_manager_phase2@test.com',
        'legit_customer_phase2@test.com'
    ];

    const safeClean = async () => {
        await prisma.order.deleteMany({ where: { user: { email: { in: testUserEmails } } } });
        await prisma.cart.deleteMany({ where: { user: { email: { in: testUserEmails } } } });
        await prisma.branchItemStatus.deleteMany({ where: { branch: { name: { contains: 'Phase 2' } } } });
        await prisma.product.deleteMany({ where: { name: { in: ['Product Branch 1', 'Product Branch 2', 'Customer Injected Sweet', 'Global Admin Confection', 'No Auth Sweet'] } } });
        await prisma.branch.deleteMany({ where: { name: { in: ['Phase 2 Store One', 'Phase 2 Store Two'] } } });
        await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
    };

    beforeAll(async () => {
        // SAFETY GUARD: Verify the database is isolated and local
        const dbUrl = process.env.DATABASE_URL || '';
        const isLocalIsolatedDb = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
        if (!isLocalIsolatedDb) {
            throw new Error(`CRITICAL SAFETY BLOCK: Refusing to execute tests against non-local database: ${dbUrl}`);
        }

        // Clean only records associated with this test suite
        await safeClean();

        const passwordHash = await hashPassword('TestPassword123!');

        // 1. Seed Admin
        adminUser = await prisma.user.create({
            data: {
                email: 'phase2_admin@test.com',
                password: passwordHash,
                name: 'System Admin',
                phone: '9000000001',
                role: 'ADMIN',
                isVerified: true
            }
        });
        adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role });

        // 2. Seed Manager 1 & Branch 1
        manager1 = await prisma.user.create({
            data: {
                email: 'phase2_mgr1@test.com',
                password: passwordHash,
                name: 'Manager Branch 1',
                phone: '9000000002',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken1 = signToken({ id: manager1.id, email: manager1.email, role: manager1.role });

        branch1 = await prisma.branch.create({
            data: {
                name: 'Phase 2 Store One',
                branchName: 'Store One',
                city: 'Chennai',
                gstNumber: 'GSTIN0001',
                storeStatus: 'verified',
                isVisible: true,
                managerId: manager1.id
            }
        });

        // 3. Seed Manager 2 & Branch 2
        manager2 = await prisma.user.create({
            data: {
                email: 'phase2_mgr2@test.com',
                password: passwordHash,
                name: 'Manager Branch 2',
                phone: '9000000003',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken2 = signToken({ id: manager2.id, email: manager2.email, role: manager2.role });

        branch2 = await prisma.branch.create({
            data: {
                name: 'Phase 2 Store Two',
                branchName: 'Store Two',
                city: 'Bangalore',
                gstNumber: 'GSTIN0002',
                storeStatus: 'verified',
                isVisible: true,
                managerId: manager2.id
            }
        });

        // 4. Seed Customer A
        customerA = await prisma.user.create({
            data: {
                email: 'phase2_custA@test.com',
                password: passwordHash,
                name: 'Alice Customer',
                phone: '9000000004',
                role: 'CUSTOMER',
                isVerified: true
            }
        });
        customerTokenA = signToken({ id: customerA.id, email: customerA.email, role: customerA.role });

        // 5. Seed Customer B
        customerB = await prisma.user.create({
            data: {
                email: 'phase2_custB@test.com',
                password: passwordHash,
                name: 'Bob Customer',
                phone: '9000000005',
                role: 'CUSTOMER',
                isVerified: true
            }
        });
        customerTokenB = signToken({ id: customerB.id, email: customerB.email, role: customerB.role });

        // 6. Seed Products
        productA = await prisma.product.create({
            data: {
                name: 'Product Branch 1',
                price: 80,
                category: 'Sweets',
                imageUrl: 'https://example.com/p1.jpg',
                isAvailable: true,
                branchId: branch1.id
            }
        });

        productB = await prisma.product.create({
            data: {
                name: 'Product Branch 2',
                price: 120,
                category: 'Sweets',
                imageUrl: 'https://example.com/p2.jpg',
                isAvailable: true,
                branchId: branch2.id
            }
        });

        // 7. Seed Orders
        orderA = await prisma.order.create({
            data: {
                userId: customerA.id,
                branchId: branch1.id,
                orderTotal: 94.4,
                orderType: 'DINE_IN',
                paymentMethod: 'CASH',
                paymentStatus: 'pending',
                status: 'RECEIVED',
                items: [{
                    productId: productA.id,
                    productName: productA.name,
                    price: 80,
                    quantity: 1,
                    totalPrice: 80
                }]
            }
        });

        orderB = await prisma.order.create({
            data: {
                userId: customerB.id,
                branchId: branch2.id,
                orderTotal: 141.6,
                orderType: 'TAKEAWAY',
                paymentMethod: 'CASH',
                paymentStatus: 'pending',
                status: 'RECEIVED',
                items: [{
                    productId: productB.id,
                    productName: productB.name,
                    price: 120,
                    quantity: 1,
                    totalPrice: 120
                }]
            }
        });
    });

    afterAll(async () => {
        await safeClean();
        await prisma.$disconnect();
    });

    // =========================================================================
    // Test 1: Registration Privilege Escalation
    // =========================================================================
    describe('Test 1: Registration Privilege Escalation Verification', () => {
        test('1.1 Attempt registration with role ADMIN is rejected', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'rogue_admin@test.com',
                    password: 'Password123!',
                    name: 'Rogue Admin',
                    phone: '9111111111',
                    role: 'ADMIN'
                });

            expect([400, 403]).toContain(res.status);
            expect(res.body.token).toBeUndefined();

            const dbUser = await prisma.user.findUnique({ where: { email: 'rogue_admin@test.com' } });
            expect(dbUser).toBeNull();
        });

        test('1.2 Attempt registration with role MANAGER creates unverified account with no token', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'applicant_manager_phase2@test.com',
                    password: 'Password123!',
                    name: 'Applicant Manager Phase 2',
                    phone: '9111111112',
                    role: 'MANAGER'
                });

            expect(res.status).toBe(201);
            expect(res.body.token).toBeNull();
            expect(res.body.user.role).toBe('MANAGER');
            expect(res.body.user.isVerified).toBe(false);

            // Verify login is blocked
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'applicant_manager_phase2@test.com',
                    password: 'Password123!'
                });

            expect([400, 403]).toContain(loginRes.status);
            expect(loginRes.body.token).toBeUndefined();
        });

        test('1.3 Legitimate customer registration defaults safely to CUSTOMER with active token', async () => {
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'legit_customer_phase2@test.com',
                    password: 'Password123!',
                    name: 'Legit Customer',
                    phone: '9111111113'
                });

            expect(res.status).toBe(201);
            expect(res.body.token).toBeDefined();
            expect(res.body.user.role).toBe('CUSTOMER');
            expect(res.body.user.isVerified).toBe(true);

            // Verify customer can log in
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'legit_customer_phase2@test.com',
                    password: 'Password123!'
                });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.token).toBeDefined();
        });

        test('1.4 Admin workflow can approve pending manager and grant login access', async () => {
            // Find the pending manager created in 1.2
            const pending = await prisma.user.findUnique({ where: { email: 'applicant_manager_phase2@test.com' } });
            expect(pending).not.toBeNull();

            // Admin approves the manager
            const approveRes = await request(app)
                .put(`/api/admin/managers/${pending.id}/approve`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(approveRes.status).toBe(200);

            // Approved manager can now log in
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'applicant_manager_phase2@test.com',
                    password: 'Password123!'
                });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.token).toBeDefined();
            expect(loginRes.body.user.isVerified).toBe(true);
        });
    });

    // =========================================================================
    // Test 2: Payment Verification
    // =========================================================================
    describe('Test 2: Payment Verification & Checkout Safety', () => {
        test('2.1 Order with UPI and fabricated paymentStatus: paid is ignored and saved as pending', async () => {
            await prisma.cart.upsert({
                where: { userId: customerA.id },
                update: {
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                },
                create: {
                    userId: customerA.id,
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                }
            });

            const res = await request(app)
                .post('/api/cart/confirm')
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({
                    paymentMethod: 'UPI',
                    paymentStatus: 'paid', // Fabricated paid status
                    branchId: branch1.id
                });

            expect(res.status).toBe(201);
            expect(res.body.orderId).toBeDefined();

            const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
            expect(order.paymentStatus).toBe('pending');
        });

        test('2.2 Order with CARD and fabricated paymentStatus: paid is ignored and saved as pending', async () => {
            await prisma.cart.upsert({
                where: { userId: customerA.id },
                update: {
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                },
                create: {
                    userId: customerA.id,
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                }
            });

            const res = await request(app)
                .post('/api/cart/confirm')
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({
                    paymentMethod: 'CARD',
                    paymentStatus: 'paid', // Fabricated paid status
                    branchId: branch1.id
                });

            expect(res.status).toBe(201);
            expect(res.body.orderId).toBeDefined();

            const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
            expect(order.paymentStatus).toBe('pending');
        });

        test('2.3 Legitimate CASH checkout continues to work with pending paymentStatus', async () => {
            await prisma.cart.upsert({
                where: { userId: customerA.id },
                update: {
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                },
                create: {
                    userId: customerA.id,
                    items: [{ productId: productA.id, productName: productA.name, price: 80, quantity: 1 }],
                    total: 80
                }
            });

            const res = await request(app)
                .post('/api/cart/confirm')
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({
                    paymentMethod: 'CASH',
                    branchId: branch1.id
                });

            expect(res.status).toBe(201);
            const order = await prisma.order.findUnique({ where: { id: res.body.orderId } });
            expect(order.paymentMethod).toBe('CASH');
            expect(order.paymentStatus).toBe('pending');
        });
    });

    // =========================================================================
    // Test 3: Product Authorization
    // =========================================================================
    describe('Test 3: Product Authorization & Multi-Branch Scoping', () => {
        test('3.1 Customer cannot create, update, or delete products (403 Forbidden)', async () => {
            // Create attempt
            const postRes = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({
                    name: 'Customer Injected Sweet',
                    price: 1,
                    category: 'Test',
                    imageUrl: 'https://example.com/bad.jpg'
                });
            expect(postRes.status).toBe(403);

            // Update attempt
            const putRes = await request(app)
                .put(`/api/products/${productA.id}`)
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({ price: 0.5 });
            expect(putRes.status).toBe(403);

            // Delete attempt
            const deleteRes = await request(app)
                .delete(`/api/products/${productA.id}`)
                .set('Authorization', `Bearer ${customerTokenA}`);
            expect(deleteRes.status).toBe(403);

            // Availability attempt
            const patchRes = await request(app)
                .patch(`/api/products/${productA.id}/availability`)
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({ isAvailable: false });
            expect(patchRes.status).toBe(403);
        });

        test('3.2 Unauthenticated product mutations are rejected (401 Unauthorized)', async () => {
            const res = await request(app)
                .post('/api/products')
                .send({ name: 'No Auth Sweet', price: 10 });
            expect(res.status).toBe(401);
        });

        test('3.3 Manager 1 can update a product belonging to their authorized branch', async () => {
            const res = await request(app)
                .put(`/api/products/${productA.id}`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ price: 85 });

            expect(res.status).toBe(200);

            const updated = await prisma.product.findUnique({ where: { id: productA.id } });
            expect(updated.price).toBe(85);
        });

        test('3.4 Manager 1 cannot update a product belonging to another branch (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/products/${productB.id}`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ price: 1 });

            expect(res.status).toBe(403);

            // Verify product B price unchanged
            const pB = await prisma.product.findUnique({ where: { id: productB.id } });
            expect(pB.price).toBe(120);
        });

        test('3.5 Admin can create and delete products globally', async () => {
            const createRes = await request(app)
                .post('/api/products')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({
                    name: 'Global Admin Confection',
                    price: 200,
                    category: 'Exotic',
                    imageUrl: 'https://example.com/exotic.jpg'
                });

            expect(createRes.status).toBe(201);
            const createdId = createRes.body.id;

            const deleteRes = await request(app)
                .delete(`/api/products/${createdId}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(deleteRes.status).toBe(200);
            const inDb = await prisma.product.findUnique({ where: { id: createdId } });
            expect(inDb).toBeNull();
        });
    });

    // =========================================================================
    // Test 4: Order Ownership & Status Control
    // =========================================================================
    describe('Test 4: Order Ownership, Status Machine & Privacy Protection', () => {
        test('4.1 Customer B cannot retrieve Customer A order (403 Forbidden) and no PII is leaked', async () => {
            const res = await request(app)
                .get(`/api/orders/${orderA.id}`)
                .set('Authorization', `Bearer ${customerTokenB}`);

            expect(res.status).toBe(403);
            expect(res.body.order).toBeUndefined();
            expect(res.body.user).toBeUndefined();
            expect(res.body.items).toBeUndefined();
        });

        test('4.2 Customer A can retrieve their own order (200 OK)', async () => {
            const res = await request(app)
                .get(`/api/orders/${orderA.id}`)
                .set('Authorization', `Bearer ${customerTokenA}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(orderA.id);
            expect(res.body.items).toHaveLength(1);
        });

        test('4.3 Customer A cannot directly modify order status (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/orders/${orderA.id}/status`)
                .set('Authorization', `Bearer ${customerTokenA}`)
                .send({ status: 'COMPLETED' });

            expect(res.status).toBe(403);
        });

        test('4.4 Manager 2 cannot update order belonging to Branch 1 (403 Forbidden)', async () => {
            const res = await request(app)
                .put(`/api/orders/${orderA.id}/status`)
                .set('Authorization', `Bearer ${managerToken2}`)
                .send({ status: 'PREPARING' });

            expect(res.status).toBe(403);
        });

        test('4.5 Manager 1 can transition order of Branch 1 from RECEIVED to PREPARING (200 OK)', async () => {
            const res = await request(app)
                .put(`/api/orders/${orderA.id}/status`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ status: 'PREPARING' });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('PREPARING');
        });

        test('4.6 Invalid status transition jump is rejected (400 Bad Request)', async () => {
            // Order A is now PREPARING. Jumping directly to COMPLETED without READY must fail
            const res = await request(app)
                .put(`/api/orders/${orderA.id}/status`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ status: 'COMPLETED' });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/Invalid status transition/);
        });

        test('4.7 Admin can view any order (200 OK)', async () => {
            const res = await request(app)
                .get(`/api/orders/${orderA.id}`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(200);
            expect(res.body.id).toBe(orderA.id);
        });

        test('4.8 Unauthenticated order access is rejected (401 Unauthorized)', async () => {
            const res = await request(app)
                .get(`/api/orders/${orderA.id}`);

            expect(res.status).toBe(401);
        });
    });
});
