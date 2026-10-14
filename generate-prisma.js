const { execSync } = require('child_process');
process.env.MONGO_URI = "mongodb://localhost:27017/sweet-shop";
console.log("Generating Prisma Client...");
try {
    execSync('npx prisma generate', { stdio: 'inherit', cwd: __dirname });
} catch (e) {
    console.error("Failed to generate client");
    process.exit(1);
}
