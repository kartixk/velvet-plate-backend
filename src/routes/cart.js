const express = require("express");
const { authMiddleware } = require("../middleware/auth");
const { validate } = require("../middleware/validate");
const { cartItemSchema, buyNowSchema, updateQuantitySchema, orderTypeSchema } = require("../validators/cartValidator");
const cartController = require("../controllers/cartController");

const router = express.Router();

router.get("/", authMiddleware, cartController.getCart);

router.post(
  "/items",
  authMiddleware,
  validate(cartItemSchema),
  cartController.addOrUpdateItem
);

router.put(
  "/items/:sweetId", // keeping path param sweetId for backwards compatibility but logic uses both
  authMiddleware,
  validate(updateQuantitySchema),
  cartController.updateItemQuantity
);

router.delete("/items/:sweetId", authMiddleware, cartController.removeItem);

router.post("/confirm", authMiddleware, cartController.confirmOrder);

router.put(
  "/order-type",
  authMiddleware,
  // validate(orderTypeSchema),  // Assuming will add it
  cartController.updateOrderType
);

router.post(
  "/buy-now",
  authMiddleware,
  validate(buyNowSchema),
  cartController.buyNow
);

module.exports = router;