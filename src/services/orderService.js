const prisma = require("../prismaClient");
const { sendOrderStatusUpdateEmail } = require("../utils/email");

const ALLOWED_STATUS_TRANSITIONS = {
    RECEIVED: ["PREPARING", "CANCELLED"],
    PREPARING: ["READY", "CANCELLED"],
    READY: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: []
};

const getMyBranchOrders = async (managerId, currentUser) => {
    const role = (currentUser?.role || "").toUpperCase();
    if (role !== "MANAGER" && role !== "ADMIN") {
        const err = new Error("Forbidden: Staff access required");
        err.statusCode = 403;
        throw err;
    }

    // 1. Get the branch managed by this user
    const branch = await prisma.branch.findUnique({
        where: { managerId }
    });

    if (!branch) {
        const err = new Error("No branch found for this manager");
        err.statusCode = 404;
        throw err;
    }

    // 2. Get all orders for this branch
    return await prisma.order.findMany({
        where: { branchId: branch.id },
        include: {
            user: { select: { id: true, name: true, phone: true, email: true } }
        },
        orderBy: { createdAt: 'desc' }
    });
};

const getOrderById = async (orderId, currentUser) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { id: true, name: true, phone: true, email: true } },
            branch: { select: { id: true, name: true, address: true, phone: true, managerId: true } }
        }
    });

    if (!order) return null;

    if (!currentUser) {
        const err = new Error("Unauthorized");
        err.statusCode = 401;
        throw err;
    }

    const role = (currentUser.role || "").toUpperCase();
    const isOwner = order.userId === currentUser.id;
    const isAdmin = role === "ADMIN";
    const isBranchManager = role === "MANAGER" && order.branch?.managerId === currentUser.id;

    if (!isOwner && !isAdmin && !isBranchManager) {
        const err = new Error("Forbidden: You do not have access to this order");
        err.statusCode = 403;
        throw err;
    }

    // If the viewer is the customer (not manager/admin), strip manager internal relation
    if (isOwner && !isAdmin && !isBranchManager) {
        const { managerId, ...safeBranch } = order.branch || {};
        return {
            ...order,
            branch: safeBranch
        };
    }

    return order;
};

const updateOrderStatus = async (orderId, newStatus, currentUser) => {
    const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: {
            user: { select: { email: true, name: true } },
            branch: { select: { id: true, managerId: true } }
        }
    });

    if (!order) {
        const err = new Error("Order not found");
        err.statusCode = 404;
        throw err;
    }

    if (!currentUser) {
        const err = new Error("Unauthorized");
        err.statusCode = 401;
        throw err;
    }

    const role = (currentUser.role || "").toUpperCase();
    const isAdmin = role === "ADMIN";
    const isBranchManager = role === "MANAGER" && order.branch?.managerId === currentUser.id;

    if (!isAdmin && !isBranchManager) {
        const err = new Error("Forbidden: Only authorized branch managers or admins can update order status");
        err.statusCode = 403;
        throw err;
    }

    // Enforce permitted status transitions
    const currentStatus = order.status;
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowedNext.includes(newStatus)) {
        const err = new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
        err.statusCode = 400;
        throw err;
    }

    const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: newStatus },
        include: {
            user: { select: { email: true, name: true } }
        }
    });

    // Send email notification to customer
    if (updatedOrder.user?.email) {
        sendOrderStatusUpdateEmail(updatedOrder.user.email, updatedOrder.user.name || 'Customer', updatedOrder.id, newStatus);
    }

    return updatedOrder;
};

const getUserOrders = async (userId) => {
    return await prisma.order.findMany({
        where: { userId },
        include: {
            branch: { select: { name: true, address: true, phone: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });
};

const collectOrder = async (orderId, userId) => {
    // 1. Fetch order to verify ownership and status
    const order = await prisma.order.findUnique({
        where: { id: orderId }
    });

    if (!order) {
        const error = new Error("Order not found");
        error.statusCode = 404;
        throw error;
    }

    if (order.userId !== userId) {
        const error = new Error("Forbidden: Unauthorized to collect this order");
        error.statusCode = 403;
        throw error;
    }

    if (order.status !== "READY") {
        const error = new Error("Order is not ready for collection yet");
        error.statusCode = 400;
        throw error;
    }

    // 2. Transition order to COMPLETED
    const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: "COMPLETED" },
        include: {
            user: { select: { email: true, name: true } }
        }
    });

    if (updated.user?.email) {
        sendOrderStatusUpdateEmail(updated.user.email, updated.user.name || 'Customer', updated.id, "COMPLETED");
    }

    return updated;
};

module.exports = {
    ALLOWED_STATUS_TRANSITIONS,
    getMyBranchOrders,
    getOrderById,
    updateOrderStatus,
    getUserOrders,
    collectOrder
};
