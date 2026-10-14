module.exports = async function () {
    const replSet = global.__MONGOINSTANCE;
    const prisma = global.__PRISMA;

    if (prisma) {
        await prisma.$disconnect();
    }

    if (replSet) {
        await replSet.stop();
    }
};
