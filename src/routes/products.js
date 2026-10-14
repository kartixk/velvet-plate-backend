const express = require("express");
const { authMiddleware, requireAdmin, requireStaff } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const {
  productSchema,
  productUpdateSchema,
  purchaseSchema,
  restockSchema,
} = require("../validators/productValidator");
const productController = require("../controllers/productController");

const router = express.Router();

router.get("/", productController.getAllProducts);

router.post(
  "/",
  authMiddleware,
  requireStaff,
  validate(productSchema),
  productController.upsertProduct
);

router.put(
  "/:id",
  authMiddleware,
  requireStaff,
  validate(productUpdateSchema),
  productController.updateProductById
);

router.delete("/:id", authMiddleware, requireStaff, productController.deleteProductById);

router.post(
  "/:id/purchase",
  authMiddleware,
  validate(purchaseSchema),
  productController.purchaseProduct
);

router.post(
  "/:id/restock",
  authMiddleware,
  requireAdmin,
  validate(restockSchema),
  productController.restockProduct
);

router.patch(
  "/:id/availability",
  authMiddleware,
  productController.updateAvailability
);

module.exports = router;
