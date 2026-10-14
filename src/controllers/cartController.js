// backend/src/controllers/cartController.js
const cartService = require("../services/cartService");

// 1. Get Cart
exports.getCart = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const cart = await cartService.getCart(userId);
        res.status(200).json(cart);
    } catch (error) {
        next(error);
    }
};

// 2. Add or Update Item in Cart
exports.addOrUpdateItem = async (req, res, next) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user.id || req.user._id;
        const cart = await cartService.addOrUpdateItem(userId, productId, Number(quantity));
        res.status(200).json({ status: 'success', cart });
    } catch (error) {
        next(error);
    }
};

// 3. Update Item Quantity
exports.updateItemQuantity = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const { sweetId } = req.params;
        const userId = req.user.id || req.user._id;
        const cart = await cartService.updateItemQuantity(userId, sweetId, Number(quantity));
        res.status(200).json({ status: 'success', cart });
    } catch (error) {
        next(error);
    }
};

// 4. Remove Item from Cart
exports.removeItem = async (req, res, next) => {
    try {
        const { sweetId } = req.params;
        const userId = req.user.id || req.user._id;
        const cart = await cartService.removeItem(userId, sweetId);
        res.status(200).json({ status: 'success', cart });
    } catch (error) {
        next(error);
    }
};

// 5. Update Order Type
exports.updateOrderType = async (req, res, next) => {
    try {
        const { orderType } = req.body;
        const userId = req.user.id || req.user._id;
        const cart = await cartService.updateOrderType(userId, orderType);
        res.status(200).json({ status: 'success', cart });
    } catch (error) {
        next(error);
    }
};

// 6. Confirm Order (Checkout)
exports.confirmOrder = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const { paymentMethod, branchId } = req.body;
        const result = await cartService.confirmOrder(userId, paymentMethod, branchId);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};

// 7. Buy Now (One-click checkout)
exports.buyNow = async (req, res, next) => {
    try {
        const { productId, quantity, orderType } = req.body;
        const userId = req.user.id || req.user._id;
        const result = await cartService.buyNow(userId, productId, Number(quantity), orderType);
        res.status(201).json(result);
    } catch (error) {
        next(error);
    }
};

// Deprecated or Aliased functions for compatibility if needed
exports.addToCart = exports.addOrUpdateItem;
exports.checkout = exports.confirmOrder;
