const { MongoMemoryReplSet } = require('mongodb-memory-server');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

let replSet;
let prisma;

module.exports = async () => {
    // Start an in-memory MongoDB Replica Set
    replSet = await MongoMemoryReplSet.create({
        replSet: { count: 1, storageEngine: 'wiredTiger' }
    });

    const uri = replSet.getUri('sweetshop_test');

    // Set the environment variable for Prisma
    process.env.DATABASE_URL = uri;

    // Initialize Prisma to pick up the new DATABASE_URL
    prisma = new PrismaClient({
        datasources: {
            db: {
                url: uri,
            },
        },
    });

    // We must push the schema into the memory DB for Prisma to recognize collections
    // MongoDB handles schemas less strictly, but Prisma maps it.
    console.log("Memory MongoDB ReplicaSet running on", uri);

    // Crucial step: push schema to memory server to create namespaces
    execSync('npx prisma db push --skip-generate', {
        env: {
            ...process.env,
            DATABASE_URL: uri
        },
        stdio: 'inherit'
    });

    global.__MONGOINSTANCE = replSet;
    global.__PRISMA = prisma;
};
