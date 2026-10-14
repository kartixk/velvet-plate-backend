// Tests will run with a test generated JWT Secret and point to the generated URIs
process.env.JWT_SECRET = 'jest-only-secret-key-not-for-real-use-0123456789';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.CLOUDINARY_URL = '';
process.env.ENABLE_CLOUDINARY = 'false';
process.env.RESEND_API_KEY = '';
process.env.RESEND_FROM = '';
if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'mongodb://127.0.0.1:27017/sweetshop_test';
}

// Mock Prisma Client to enforce using the dynamic in-memory URL
jest.mock('../src/prismaClient', () => {
    const { PrismaClient } = require('@prisma/client');
    return new PrismaClient({
        datasources: {
            db: {
                // Must pull from what globalSetup sets on process env
                url: process.env.DATABASE_URL
            }
        }
    });
});

// Mock email service to prevent background SMTP network calls and console leaks during test runs
jest.mock('../src/utils/email', () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
    sendManagerAccountVerifiedEmail: jest.fn().mockResolvedValue(true),
    sendWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendManagerWelcomeEmail: jest.fn().mockResolvedValue(true),
    sendStoreVerifiedEmail: jest.fn().mockResolvedValue(true),
    sendStoreStatusChangeEmail: jest.fn().mockResolvedValue(true),
    sendOnboardingSubmissionEmail: jest.fn().mockResolvedValue(true),
    sendOrderConfirmationEmail: jest.fn().mockResolvedValue(true),
    sendOrderStatusUpdateEmail: jest.fn().mockResolvedValue(true),
    sendUrgentUplinkEmail: jest.fn().mockResolvedValue(true),
}));

