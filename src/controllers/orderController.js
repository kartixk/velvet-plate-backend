const orderService = require("../services/orderService");

const getMyBranchOrders = async (req, res, next) => {
    try {
        const managerId = req.user.id || req.user._id;
        const orders = await orderService.getMyBranchOrders(managerId, req.user);
        res.status(200).json(orders);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
};

const getOrderById = async (req, res, next) => {
    try {
        const order = await orderService.getOrderById(req.params.id, req.user);
        if (!order) return res.status(404).json({ message: "Order not found" });
        res.status(200).json(order);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const order = await orderService.updateOrderStatus(req.params.id, status, req.user);
        res.status(200).json(order);
    } catch (err) {
        if (err.statusCode) {
            return res.status(err.statusCode).json({ error: err.message });
        }
        next(err);
    }
};

const getUserOrders = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const orders = await orderService.getUserOrders(userId);
        res.status(200).json(orders);
    } catch (err) {
        next(err);
    }
};

const collectOrder = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const userId = req.user.id || req.user._id;
        const order = await orderService.collectOrder(orderId, userId);
        res.status(200).json(order);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getMyBranchOrders,
    getOrderById,
    updateOrderStatus,
    getUserOrders,
    collectOrder
};
