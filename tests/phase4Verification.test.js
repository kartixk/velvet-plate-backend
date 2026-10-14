const request = require('supertest');
const { execSync } = require('child_process');
const path = require('path');
const app = require('../src/app');
const prisma = require('../src/prismaClient');
const { signToken, hashPassword } = require('../src/services/auth');

describe('🛡️ Phase 4.2: Production Security Hardening & Regression Suite', () => {
    let adminUser, adminToken;

    beforeAll(async () => {
        // SAFETY GUARD: Verify the database is isolated and local
        const dbUrl = process.env.DATABASE_URL || '';
        const isLocalIsolatedDb = dbUrl.includes('127.0.0.1') || dbUrl.includes('localhost');
        if (!isLocalIsolatedDb) {
            throw new Error(`CRITICAL SAFETY BLOCK: Refusing to execute tests against non-local database: ${dbUrl}`);
        }

        const passwordHash = await hashPassword('Phase4Password123!');
        adminUser = await prisma.user.create({
            data: {
                email: 'phase4_admin@test.com',
                password: passwordHash,
                name: 'Phase 4 Admin',
                phone: '9555555555',
                role: 'ADMIN',
                isVerified: true
            }
        });
        adminToken = signToken({ id: adminUser.id, email: adminUser.email, role: adminUser.role });
    });

    afterAll(async () => {
        await prisma.user.deleteMany({ where: { email: 'phase4_admin@test.com' } });
    });

    /* ==========================================================================
       TASK 1: HTTP SECURITY HEADERS VERIFICATION
       ========================================================================== */
    describe('Task 1: HTTP Security Headers', () => {
        test('1.1 X-Powered-By header is removed / disabled', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-powered-by']).toBeUndefined();
        });

        test('1.2 Essential security headers are emitted (Helmet protection)', async () => {
            const res = await request(app).get('/api/health');
            expect(res.headers['x-content-type-options']).toBe('nosniff');
            expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
            expect(res.headers['cross-origin-resource-policy']).toBe('cross-origin');
            expect(res.headers['x-dns-prefetch-control']).toBe('off');
        });
    });

    /* ==========================================================================
       TASK 2: SWAGGER EXPOSURE GUARD VERIFICATION
       ========================================================================== */
    describe('Task 2: Swagger Exposure Control', () => {
        test('2.1 Root endpoint does not advertise disabled Swagger docs in production', async () => {
            const originalEnv = process.env.NODE_ENV;
            const originalSwagger = process.env.ENABLE_SWAGGER;
            try {
                process.env.NODE_ENV = 'production';
                delete process.env.ENABLE_SWAGGER;

                const res = await request(app).get('/');
                expect(res.status).toBe(200);
                expect(res.text).not.toContain('/api-docs');
                expect(res.text).toContain('Server Ready');
            } finally {
                process.env.NODE_ENV = originalEnv;
                if (originalSwagger) process.env.ENABLE_SWAGGER = originalSwagger;
            }
        });

        test('2.2 Swagger documentation is disabled by default in production (404)', async () => {
            let prodApp;
            jest.isolateModules(() => {
                const originalEnv = process.env.NODE_ENV;
                const originalSwagger = process.env.ENABLE_SWAGGER;
                const originalSalt = process.env.BCRYPT_SALT_ROUNDS;
                try {
                    process.env.NODE_ENV = 'production';
                    process.env.BCRYPT_SALT_ROUNDS = '10';
                    delete process.env.ENABLE_SWAGGER;
                    prodApp = require('../src/app');
                } finally {
                    process.env.NODE_ENV = originalEnv;
                    process.env.BCRYPT_SALT_ROUNDS = originalSalt;
                    if (originalSwagger) process.env.ENABLE_SWAGGER = originalSwagger;
                }
            });

            const res = await request(prodApp).get('/api-docs');
            expect(res.status).toBe(404);
        });
    });

    /* ==========================================================================
       TASK 3: ENVIRONMENT VALIDATION (DATABASE_URL & CLOUDINARY)
       ========================================================================== */
    describe('Task 3: Environment Configuration Validation', () => {
        test('3.1 Startup fails when DATABASE_URL is missing', () => {
            expect(() => {
                jest.isolateModules(() => {
                    const originalDb = process.env.DATABASE_URL;
                    try {
                        process.env.DATABASE_URL = '';
                        require('../src/config/env');
                    } finally {
                        process.env.DATABASE_URL = originalDb;
                    }
                });
            }).toThrow(/DATABASE_URL is required but not set/i);
        });

        test('3.2 Startup fails when DATABASE_URL is not a valid MongoDB URI', () => {
            expect(() => {
                jest.isolateModules(() => {
                    const originalDb = process.env.DATABASE_URL;
                    try {
                        process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
                        require('../src/config/env');
                    } finally {
                        process.env.DATABASE_URL = originalDb;
                    }
                });
            }).toThrow(/DATABASE_URL must be a valid MongoDB connection string/i);
        });

        test('3.3 Startup fails when Cloudinary is partially configured', () => {
            expect(() => {
                jest.isolateModules(() => {
                    const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
                    const originalApiKey = process.env.CLOUDINARY_API_KEY;
                    const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
                    try {
                        process.env.CLOUDINARY_CLOUD_NAME = 'my-cloud';
                        process.env.CLOUDINARY_API_KEY = '';
                        process.env.CLOUDINARY_API_SECRET = '';
                        require('../src/config/env');
                    } finally {
                        if (originalCloudName !== undefined) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName; else delete process.env.CLOUDINARY_CLOUD_NAME;
                        if (originalApiKey !== undefined) process.env.CLOUDINARY_API_KEY = originalApiKey; else delete process.env.CLOUDINARY_API_KEY;
                        if (originalApiSecret !== undefined) process.env.CLOUDINARY_API_SECRET = originalApiSecret; else delete process.env.CLOUDINARY_API_SECRET;
                    }
                });
            }).toThrow(/Incomplete Cloudinary configuration/i);
        });

        test('3.4 Startup fails when ENABLE_CLOUDINARY=true but credentials are missing', () => {
            expect(() => {
                jest.isolateModules(() => {
                    const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
                    const originalApiKey = process.env.CLOUDINARY_API_KEY;
                    const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
                    const originalEnable = process.env.ENABLE_CLOUDINARY;
                    try {
                        process.env.CLOUDINARY_CLOUD_NAME = '';
                        process.env.CLOUDINARY_API_KEY = '';
                        process.env.CLOUDINARY_API_SECRET = '';
                        process.env.ENABLE_CLOUDINARY = 'true';
                        require('../src/config/env');
                    } finally {
                        if (originalCloudName !== undefined) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName; else delete process.env.CLOUDINARY_CLOUD_NAME;
                        if (originalApiKey !== undefined) process.env.CLOUDINARY_API_KEY = originalApiKey; else delete process.env.CLOUDINARY_API_KEY;
                        if (originalApiSecret !== undefined) process.env.CLOUDINARY_API_SECRET = originalApiSecret; else delete process.env.CLOUDINARY_API_SECRET;
                        if (originalEnable !== undefined) process.env.ENABLE_CLOUDINARY = originalEnable; else delete process.env.ENABLE_CLOUDINARY;
                    }
                });
            }).toThrow(/Cloudinary is enabled .* but credentials are incomplete/i);
        });

        test('3.5 Document upload returns 503 Service Unavailable when Cloudinary is unconfigured', async () => {
            let isolatedApp;
            jest.isolateModules(() => {
                const originalCloudName = process.env.CLOUDINARY_CLOUD_NAME;
                const originalApiKey = process.env.CLOUDINARY_API_KEY;
                const originalApiSecret = process.env.CLOUDINARY_API_SECRET;
                try {
                    process.env.CLOUDINARY_CLOUD_NAME = '';
                    process.env.CLOUDINARY_API_KEY = '';
                    process.env.CLOUDINARY_API_SECRET = '';
                    isolatedApp = require('../src/app');
                } finally {
                    if (originalCloudName !== undefined) process.env.CLOUDINARY_CLOUD_NAME = originalCloudName; else delete process.env.CLOUDINARY_CLOUD_NAME;
                    if (originalApiKey !== undefined) process.env.CLOUDINARY_API_KEY = originalApiKey; else delete process.env.CLOUDINARY_API_KEY;
                    if (originalApiSecret !== undefined) process.env.CLOUDINARY_API_SECRET = originalApiSecret; else delete process.env.CLOUDINARY_API_SECRET;
                }
            });

            const res = await request(isolatedApp)
                .post('/api/branches/upload')
                .set('Authorization', `Bearer ${adminToken}`)
                .send({});

            expect(res.status).toBe(503);
            expect(res.body.error).toMatch(/Cloudinary storage is not configured/i);
        });
    });

    /* ==========================================================================
       TASK 4: HEALTH CHECK ENDPOINT
       ========================================================================== */
    describe('Task 4: Application Health Route', () => {
        test('4.1 Health check probe returns 200 with operational status', async () => {
            const res = await request(app).get('/api/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ok');
            expect(res.body.service).toMatch(/Velvet Plate/i);
            expect(res.body.timestamp).toBeDefined();
        });

        test('4.2 Health check endpoint bypasses /api rate limiter', async () => {
            let prodApp;
            jest.isolateModules(() => {
                const origEnv = process.env.NODE_ENV;
                const origSalt = process.env.BCRYPT_SALT_ROUNDS;
                try {
                    process.env.NODE_ENV = 'production';
                    process.env.BCRYPT_SALT_ROUNDS = '10';
                    prodApp = require('../src/app');
                } finally {
                    process.env.NODE_ENV = origEnv;
                    process.env.BCRYPT_SALT_ROUNDS = origSalt;
                }
            });

            // /api/health is mounted before rate limiter: it should NOT have limiter headers
            const healthRes = await request(prodApp).get('/api/health');
            expect(healthRes.status).toBe(200);
            expect(healthRes.headers['ratelimit-limit']).toBeUndefined();
        });
    });

    /* ==========================================================================
       TASK 5: RENDER DEPLOYMENT & TRUST PROXY VERIFICATION
       ========================================================================== */
    describe('Task 5: Render Deployment & Trust Proxy Hardening', () => {
        test('5.1 Startup fails when TRUST_PROXY is set to an invalid value', () => {
            expect(() => {
                jest.isolateModules(() => {
                    const origTrust = process.env.TRUST_PROXY;
                    try {
                        process.env.TRUST_PROXY = 'invalid_hop_count';
                        require('../src/config/env');
                    } finally {
                        if (origTrust !== undefined) process.env.TRUST_PROXY = origTrust;
                        else delete process.env.TRUST_PROXY;
                    }
                });
            }).toThrow(/TRUST_PROXY must be a boolean or a non-negative integer/i);
        });

        test('5.2 With TRUST_PROXY=1, Express correctly identifies client IP and ignores spoofed prefix IPs', async () => {
            let prodApp;
            jest.isolateModules(() => {
                const origEnv = process.env.NODE_ENV;
                const origSalt = process.env.BCRYPT_SALT_ROUNDS;
                const origTrust = process.env.TRUST_PROXY;
                try {
                    process.env.NODE_ENV = 'production';
                    process.env.BCRYPT_SALT_ROUNDS = '10';
                    process.env.TRUST_PROXY = '1';
                    prodApp = require('../src/app');
                } finally {
                    process.env.NODE_ENV = origEnv;
                    process.env.BCRYPT_SALT_ROUNDS = origSalt;
                    if (origTrust !== undefined) process.env.TRUST_PROXY = origTrust;
                    else delete process.env.TRUST_PROXY;
                }
            });

            // Attacker sends spoofed IP prepended to real proxy chain:
            // X-Forwarded-For: <spoofed_ip>, <real_client_ip>
            const res = await request(prodApp)
                .get('/api/health')
                .set('X-Forwarded-For', '198.51.100.99, 203.0.113.50');

            expect(res.status).toBe(200);
            // With trust proxy: 1, Express trusts 1 hop (immediate socket) and selects 203.0.113.50
            expect(res.body.clientIp).toBe('203.0.113.50');
            expect(res.body.clientIp).not.toBe('198.51.100.99');
        });

        test('5.3 Server configuration binds to 0.0.0.0 and process.env.PORT without fallback', () => {
            const fs = require('fs');
            const path = require('path');
            const serverCode = fs.readFileSync(path.join(__dirname, '../src/server.js'), 'utf-8');

            expect(serverCode).toContain('HOST = "0.0.0.0"');
            expect(serverCode).toContain('app.listen(PORT, HOST');
            expect(serverCode).not.toContain('PORT + 1');
            expect(serverCode).not.toContain('fallbackServer');
        });
    });
});
