const express = require("express");
const router = express.Router();
const prisma = require("../prismaClient");

// Liveness probe (shallow check: process is responsive)
router.get(["/", "/health", "/live"], (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Velvet Plate API",
    clientIp: req.ip,
    timestamp: new Date().toISOString()
  });
});

// Readiness probe (deep check: verifies database connectivity)
router.get("/ready", async (req, res) => {
  try {
    // Quick query with select to minimize overhead
    await prisma.user.findFirst({ select: { id: true } });
    return res.status(200).json({
      status: "ready",
      database: "connected",
      service: "Velvet Plate API",
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      status: "unready",
      database: "disconnected",
      error: err.message,
      service: "Velvet Plate API",
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
