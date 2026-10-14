const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const orderController = require("../controllers/orderController");

const router = express.Router();

// Manager: Get orders for their branch
router.get("/my-branch-orders", authMiddleware, orderController.getMyBranchOrders);

// Manager: Update order status
router.put("/:id/status", authMiddleware, orderController.updateOrderStatus);

// Customer/Manager: Get order details by ID
router.get("/:id", authMiddleware, orderController.getOrderById);

// Customer: Mark order as collected
router.put("/:id/collect", authMiddleware, orderController.collectOrder);

// Customer: Get all their own orders
router.get("/", authMiddleware, orderController.getUserOrders);

module.exports = router;
