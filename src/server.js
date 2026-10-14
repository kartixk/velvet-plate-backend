require("./config/env"); // validate configuration first; throws (and exits) if invalid
const app = require("./app");
const prisma = require("./prismaClient");

const HOST = "0.0.0.0";
const PORT = parseInt(process.env.PORT || "4000", 10);

async function checkDbConnection() {
  try {
    await prisma.$connect();
    console.log("✅ Successfully connected to MongoDB via Prisma");
  } catch (err) {
    console.warn("⚠️  Database connection pending or failed:", err.message);
    console.warn("👉 Check your DATABASE_URL in .env to ensure your MongoDB Atlas cluster is online.");
  }
}

async function startServer() {
  const server = app.listen(PORT, HOST, () => {
    console.log(`🚀 Restaurant API running smoothly on http://${HOST}:${PORT}`);
    if (process.env.NODE_ENV !== "production" || process.env.ENABLE_SWAGGER === "true") {
      console.log(`📑 Swagger Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🔍 OpenAPI Schema JSON:   http://localhost:${PORT}/api-docs.json`);
    }
    checkDbConnection();
  });

  server.on("error", (err) => {
    console.error(`❌ Failed to start server on ${HOST}:${PORT}:`, err.message);
    process.exit(1);
  });

  const handleShutdown = async (signal) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      console.log("🔒 HTTP server closed.");
      try {
        await prisma.$disconnect();
        console.log("💾 Prisma client disconnected.");
        process.exit(0);
      } catch (err) {
        console.error("⚠️ Error disconnecting Prisma during shutdown:", err.message);
        process.exit(1);
      }
    });

    // Timeout safety net (force shutdown if hanging connections exceed 10s)
    setTimeout(() => {
      console.error("⏱️ Graceful shutdown timed out after 10s. Forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer();
