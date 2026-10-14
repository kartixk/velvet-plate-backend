const request = require('supertest');
const jwt = require('jsonwebtoken');
const { execSync } = require('child_process');
const path = require('path');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { signToken, hashPassword } = require('../src/services/auth');

describe('🛡️ Phase 3: High-Priority Security Remediation Verification Suite', () => {
    let adminUser, adminToken;
    let manager1, managerToken1, branch1;
    let manager2, managerToken2, branch2;
    let customerUser, customerToken;

    const testUserEmails = [
        'phase3_admin@test.com',
        'phase3_mgr1@test.com',
        'phase3_mgr2@test.com',
        'phase3_customer@test.com'
    ];

    const safeClean = async () => {
        await prisma.branch.deleteMany({ where: { name: { in: ['Phase 3 Branch Alpha', 'Phase 3 Branch Beta'] } } });
        await prisma.user.deleteMany({ where: { email: { in: testUserEmails } } });
    };

    beforeAll(async () => {
        // SAFETY GUARD: Verify the database is isolated and local
        const dbUrl = process.env.DATABASE_URL || '';
        const isLocalIsolatedDb = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
        if (!isLocalIsolatedDb) {
            throw new Error(`CRITICAL SAFETY BLOCK: Refusing to execute tests against non-local database: ${dbUrl}`);
        }

        await safeClean();

        const passwordHash = await hashPassword('Phase3SecurePassword123!');

        // 1. Admin
        adminUser = await prisma.user.create({
            data: {
                email: 'phase3_admin@test.com',
                password: passwordHash,
                name: 'Phase 3 Admin',
                phone: '9111111111',
                role: 'ADMIN',
                isVerified: true
            }
        });
        adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role });

        // 2. Manager 1 & Branch 1
        manager1 = await prisma.user.create({
            data: {
                email: 'phase3_mgr1@test.com',
                password: passwordHash,
                name: 'Phase 3 Manager Alpha',
                phone: '9222222222',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken1 = signToken({ id: manager1.id, email: manager1.email, role: manager1.role });

        branch1 = await prisma.branch.create({
            data: {
                name: 'Phase 3 Branch Alpha',
                branchName: 'Alpha Store',
                city: 'Bengaluru',
                gstNumber: 'GSTINP3A',
                storeStatus: 'verified',
                isVisible: true,
                managerId: manager1.id
            }
        });

        // 3. Manager 2 & Branch 2
        manager2 = await prisma.user.create({
            data: {
                email: 'phase3_mgr2@test.com',
                password: passwordHash,
                name: 'Phase 3 Manager Beta',
                phone: '9333333333',
                role: 'MANAGER',
                isVerified: true
            }
        });
        managerToken2 = signToken({ id: manager2.id, email: manager2.email, role: manager2.role });

        branch2 = await prisma.branch.create({
            data: {
                name: 'Phase 3 Branch Beta',
                branchName: 'Beta Store',
                city: 'Bengaluru',
                gstNumber: 'GSTINP3B',
                storeStatus: 'verified',
                isVisible: false,
                managerId: manager2.id
            }
        });

        // 4. Customer
        customerUser = await prisma.user.create({
            data: {
                email: 'phase3_customer@test.com',
                password: passwordHash,
                name: 'Phase 3 Regular Customer',
                phone: '9444444444',
                role: 'CUSTOMER',
                isVerified: true
            }
        });
        customerToken = signToken({ id: customerUser.id, email: customerUser.email, role: customerUser.role });
    });

    afterAll(async () => {
        await safeClean();
    });

    /* ==========================================================================
       TASK 1: BRANCH VISIBILITY AUTHORIZATION (PUT /api/branches/:id/visibility)
       ========================================================================== */
    describe('Task 1: Branch Visibility Authorization', () => {
        test('1.1 Unauthenticated request is rejected with 401', async () => {
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .send({ isVisible: false });

            expect(res.status).toBe(401);

            // Verify database state is untouched
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch1.id } });
            expect(freshBranch.isVisible).toBe(true);
        });

        test('1.2 Customer is rejected with 403 Forbidden', async () => {
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ isVisible: false });

            expect(res.status).toBe(403);

            // Verify database state is untouched
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch1.id } });
            expect(freshBranch.isVisible).toBe(true);
        });

        test('1.3 Cross-branch manager cannot modify another branch (403 Forbidden)', async () => {
            // Manager 2 tries to alter Branch 1 (owned by Manager 1)
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .set('Authorization', `Bearer ${managerToken2}`)
                .send({ isVisible: false });

            expect(res.status).toBe(403);

            // Verify database state is untouched
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch1.id } });
            expect(freshBranch.isVisible).toBe(true);
        });

        test('1.4 Client cannot forge manager role in body or query to bypass ownership', async () => {
            // Customer sends spoofed role and managerId in body/query
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility?role=ADMIN&managerId=${manager1.id}`)
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ isVisible: false, role: 'ADMIN', managerId: manager1.id });

            expect(res.status).toBe(403);

            // DB unchanged
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch1.id } });
            expect(freshBranch.isVisible).toBe(true);
        });

        test('1.5 Non-existent branch ID returns 404 Not Found', async () => {
            const fakeId = '654321654321654321654321';
            const res = await request(app)
                .put(`/api/branches/${fakeId}/visibility`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isVisible: true });

            expect(res.status).toBe(404);
        });

        test('1.6 Non-boolean isVisible payload is rejected with 400 Bad Request', async () => {
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ isVisible: "true" }); // string instead of boolean

            expect(res.status).toBe(400);
        });

        test('1.7 Authorized manager can toggle their own branch visibility (200 OK)', async () => {
            const res = await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ isVisible: false });

            expect(res.status).toBe(200);
            expect(res.body.isVisible).toBe(false);

            // Verify DB updated
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch1.id } });
            expect(freshBranch.isVisible).toBe(false);

            // Toggle back to true
            await request(app)
                .put(`/api/branches/${branch1.id}/visibility`)
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ isVisible: true });
        });

        test('1.8 Admin can toggle any branch visibility (200 OK)', async () => {
            // Admin toggles Branch 2 (owned by Manager 2)
            const res = await request(app)
                .put(`/api/branches/${branch2.id}/visibility`)
                .set('Authorization', `Bearer ${adminToken}`)
                .send({ isVisible: true });

            expect(res.status).toBe(200);
            expect(res.body.isVisible).toBe(true);

            // Verify DB updated
            const freshBranch = await prisma.branch.findUnique({ where: { id: branch2.id } });
            expect(freshBranch.isVisible).toBe(true);
        });
    });

    /* ==========================================================================
       TASK 2: JWT AND ENVIRONMENT CONFIGURATION VERIFICATION
       ========================================================================== */
    describe('Task 2: JWT and Environment Security Verification', () => {
        test('2.1 Expired token is rejected with 401', async () => {
            const expiredToken = jwt.sign(
                { id: customerUser.id, role: 'CUSTOMER' },
                process.env.JWT_SECRET,
                { algorithm: 'HS256', expiresIn: -10, issuer: 'velvet-plate-api', audience: 'velvet-plate-client' }
            );

            const res = await request(app)
                .get('/api/branches/my-branch')
                .set('Authorization', `Bearer ${expiredToken}`);

            expect(res.status).toBe(401);
            expect(res.body.error).toMatch(/invalid or expired/i);
        });

        test('2.2 Malformed token is rejected with 401', async () => {
            const res = await request(app)
                .get('/api/branches/my-branch')
                .set('Authorization', 'Bearer invalid.token.garbage');

            expect(res.status).toBe(401);
        });

        test('2.3 Token signed with incorrect secret is rejected with 401', async () => {
            const attackerToken = jwt.sign(
                { id: customerUser.id, role: 'ADMIN' },
                'attacker-unauthorized-secret-key-32chars!!',
                { algorithm: 'HS256', expiresIn: '1h', issuer: 'velvet-plate-api', audience: 'velvet-plate-client' }
            );

            const res = await request(app)
                .get('/api/admin/overview')
                .set('Authorization', `Bearer ${attackerToken}`);

            expect(res.status).toBe(401);
        });

        test('2.4 Token with wrong issuer or audience is rejected with 401', async () => {
            const rogueIssuerToken = jwt.sign(
                { id: adminUser.id, role: 'ADMIN' },
                process.env.JWT_SECRET,
                { algorithm: 'HS256', expiresIn: '1h', issuer: 'malicious-issuer', audience: 'velvet-plate-client' }
            );

            const res = await request(app)
                .get('/api/admin/overview')
                .set('Authorization', `Bearer ${rogueIssuerToken}`);

            expect(res.status).toBe(401);
        });

        test('2.5 Passwords and password hashes are never returned in auth responses', async () => {
            const loginRes = await request(app)
                .post('/api/auth/login')
                .send({ email: customerUser.email, password: 'Phase3SecurePassword123!' });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.user).toBeDefined();
            expect(loginRes.body.user.password).toBeUndefined();
            expect(loginRes.body.user.passwordHash).toBeUndefined();
        });

        test('2.6 Production logout cookies containing HttpOnly, SameSite=Strict, and Secure', async () => {
            const originalEnv = process.env.NODE_ENV;
            try {
                process.env.NODE_ENV = 'production';
                const logoutRes = await request(app).post('/api/auth/logout');
                expect(logoutRes.status).toBe(200);

                const cookies = logoutRes.headers['set-cookie'];
                expect(cookies).toBeDefined();
                const tokenCookie = cookies.find(c => c.startsWith('token='));
                expect(tokenCookie).toBeDefined();
                expect(tokenCookie).toContain('HttpOnly');
                expect(tokenCookie).toContain('SameSite=Strict');
                expect(tokenCookie).toContain('Secure');
            } finally {
                process.env.NODE_ENV = originalEnv;
            }
        });

        test('2.7 Application startup fails when JWT_SECRET is missing', () => {
            try {
                execSync('node -e "require(\\"dotenv\\").config = () => {}; process.env.DATABASE_URL = \\"mongodb://127.0.0.1:27017/test\\"; process.env.JWT_SECRET = \\"\\"; require(\\"./src/config/env\\");"', {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'pipe'
                });
                throw new Error('Should have failed');
            } catch (err) {
                const output = err.stderr ? err.stderr.toString() : err.message;
                expect(output).toMatch(/JWT_SECRET is required but not set/i);
            }
        });

        test('2.8 Application startup fails when JWT_SECRET is too short (< 32 chars)', () => {
            try {
                execSync('node -e "require(\\"./src/config/env\\");"', {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'pipe',
                    env: { ...process.env, JWT_SECRET: 'short_key_under_32' }
                });
                throw new Error('Should have failed');
            } catch (err) {
                const output = err.stderr ? err.stderr.toString() : err.message;
                expect(output).toMatch(/must be at least 32 characters/i);
            }
        });

        test('2.9 Application startup fails when JWT_SECRET is a known placeholder', () => {
            try {
                execSync('node -e "require(\\"./src/config/env\\");"', {
                    cwd: path.resolve(__dirname, '..'),
                    stdio: 'pipe',
                    env: { ...process.env, JWT_SECRET: 'velvet_plate_auth_internal_secret_key_2026' }
                });
                throw new Error('Should have failed');
            } catch (err) {
                const output = err.stderr ? err.stderr.toString() : err.message;
                expect(output).toMatch(/known placeholder\/leaked value/i);
            }
        });

        test('2.10 Test database isolation and connection string leak protection', async () => {
            const dbUrl = process.env.DATABASE_URL || '';
            // 1. Must be local loopback
            expect(dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost')).toBe(true);

            // 2. Reject non-local / remote URIs
            const isIsolated = (url) => url.includes('127.0.0.1') || url.includes('localhost');
            expect(isIsolated('mongodb+srv://admin:pass@cluster.mongodb.net/prod')).toBe(false);

            // 3. API errors never leak DB connection strings, credentials, or topology
            const errorRes = await request(app).get('/api/products/invalid-mongo-id-999');
            const responseText = JSON.stringify(errorRes.body);
            expect(responseText).not.toContain('mongodb://');
            expect(responseText).not.toContain('mongodb+srv://');
            expect(responseText).not.toContain('sweetshop_test');
            expect(responseText).not.toContain('testset');
        });
    });

    /* ==========================================================================
       TASK 4: SUPPORT ENDPOINT ABUSE PROTECTION (POST /api/support/uplink)
       ========================================================================== */
    describe('Task 4: Support Endpoint Abuse Protection', () => {
        test('4.1 Unauthenticated request to /api/support/uplink is rejected with 401', async () => {
            const res = await request(app)
                .post('/api/support/uplink')
                .send({});

            expect(res.status).toBe(401);
        });

        test('4.2 Customer request to /api/support/uplink is rejected with 403 Forbidden', async () => {
            const res = await request(app)
                .post('/api/support/uplink')
                .set('Authorization', `Bearer ${customerToken}`)
                .send({ message: 'Urgent customer issue' });

            expect(res.status).toBe(403);
        });

        test('4.3 Authorized manager can trigger uplink and response does NOT leak admin emails', async () => {
            const res = await request(app)
                .post('/api/support/uplink')
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ message: 'Store verification follow-up request' });

            expect(res.status).toBe(200);
            expect(res.body.message).toMatch(/uplink protocol initiated/i);
            expect(res.body.referenceId).toBeDefined();

            // CRITICAL: Ensure admin email or sensitive details are never leaked in response
            expect(res.body.adminEmail).toBeUndefined();
            expect(res.body.admins).toBeUndefined();
            expect(JSON.stringify(res.body)).not.toContain(adminUser.email);
        });

        test('4.4 Oversized message payload (> 1000 characters) is rejected with 400 Bad Request', async () => {
            const massivePayload = 'A'.repeat(1050);
            const res = await request(app)
                .post('/api/support/uplink')
                .set('Authorization', `Bearer ${managerToken1}`)
                .send({ message: massivePayload });

            expect(res.status).toBe(400);
            expect(res.body.error).toMatch(/exceeds maximum allowed length/i);
        });

        test('4.5 Rate-limit exhaustion returns 429 Too Many Requests', async () => {
            // Set tight rate limit threshold for test
            process.env.SUPPORT_RATE_LIMIT_MAX = '2';
            try {
                // Request 1: OK
                const res1 = await request(app)
                    .post('/api/support/uplink')
                    .set('Authorization', `Bearer ${managerToken1}`)
                    .send({ message: 'Rate limit test 1' });
                expect([200, 429]).toContain(res1.status);

                // Request 2: OK or limit reached
                const res2 = await request(app)
                    .post('/api/support/uplink')
                    .set('Authorization', `Bearer ${managerToken1}`)
                    .send({ message: 'Rate limit test 2' });
                expect([200, 429]).toContain(res2.status);

                // Request 3: Must be rate limited
                const res3 = await request(app)
                    .post('/api/support/uplink')
                    .set('Authorization', `Bearer ${managerToken1}`)
                    .send({ message: 'Rate limit test 3' });
                expect(res3.status).toBe(429);
                expect(res3.body.error).toMatch(/too many support requests/i);
            } finally {
                delete process.env.SUPPORT_RATE_LIMIT_MAX;
            }
        });

        test('4.6 Forwarded-IP spoofing resistance (cannot bypass rate limit using X-Forwarded-For)', async () => {
            process.env.SUPPORT_RATE_LIMIT_MAX = '1';
            try {
                // Hit the limit
                await request(app)
                    .post('/api/support/uplink')
                    .set('Authorization', `Bearer ${managerToken1}`)
                    .send({ message: 'Prime the rate limit' });

                // Attempt bypass with spoofed X-Forwarded-For IP
                const spoofedRes = await request(app)
                    .post('/api/support/uplink')
                    .set('Authorization', `Bearer ${managerToken1}`)
                    .set('X-Forwarded-For', '203.0.113.195')
                    .send({ message: 'Spoofed header attempt' });

                // Must STILL be 429 because un-trusted proxy ignores forged X-Forwarded-For header
                expect(spoofedRes.status).toBe(429);
            } finally {
                delete process.env.SUPPORT_RATE_LIMIT_MAX;
            }
        });
    });
});
