const express = require("express");
const rateLimit = require("express-rate-limit");
const { authMiddleware, requireStaff } = require("../middleware/auth");
const supportController = require("../controllers/supportController");

const router = express.Router();

const getRateLimitMax = () => {
    if (process.env.SUPPORT_RATE_LIMIT_MAX) {
        return parseInt(process.env.SUPPORT_RATE_LIMIT_MAX, 10);
    }
    return process.env.NODE_ENV === "production" ? 5 : 100;
};

const supportLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: (req, res) => getRateLimitMax(),
    message: { error: "Too many support requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

// Staff (Manager/Admin): Trigger urgent support uplink with abuse protection
router.post("/uplink", supportLimiter, authMiddleware, requireStaff, supportController.triggerUplink);

module.exports = router;
