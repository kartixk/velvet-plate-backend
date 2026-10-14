const express = require("express");
const { authMiddleware, requireAdmin, requireStaff } = require("../middleware/auth");
const reportController = require("../controllers/reportController");

const router = express.Router();

router.get("/sales", authMiddleware, requireAdmin, reportController.getSalesReports);
router.get("/branch-sales", authMiddleware, requireStaff, reportController.getBranchSalesReports);

module.exports = router;
