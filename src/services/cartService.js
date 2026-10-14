const prisma = require("../prismaClient");
const { sendOrderConfirmationEmail } = require("../utils/email");

const getCart = async (userId) => {
    const cart = await prisma.cart.findUnique({
        where: { userId }
    });
    return cart || { items: [], total: 0, orderType: "DINE_IN" };
};

const addOrUpdateItem = async (userId, productId, quantity) => {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Product not found");

    if (!product.isAvailable) {
        throw new Error("Product is currently unavailable");
    }

    let cart = await prisma.cart.findUnique({ where: { userId } });

    if (!cart) {
        cart = await prisma.cart.create({
            data: {
                userId,
                items: [],
                total: 0,
                orderType: "DINE_IN"
            }
        });
    }

    const items = [...cart.items];
    const index = items.findIndex(i => i.productId === productId);

    if (index > -1) {
        items[index].quantity = quantity;
        items[index].price = product.price;
    } else {
        items.push({
            productId: product.id,
            productName: product.name,
            price: product.price,
            quantity: quantity,
        });
    }

    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

    const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: { items, total }
    });

    return updatedCart;
};

const updateItemQuantity = async (userId, productId, quantity) => {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new Error("Cart not found");

    const items = [...cart.items];
    const itemIndex = items.findIndex(item => item.productId === productId);

    if (itemIndex === -1) {
        throw new Error("Item not found in cart");
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (product && !product.isAvailable) {
        throw new Error("Product is currently unavailable");
    }

    items[itemIndex].quantity = quantity;
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

    const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: { items, total }
    });

    return updatedCart;
};

const removeItem = async (userId, productId) => {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new Error("Cart not found");

    const items = cart.items.filter(i => i.productId !== productId);
    const total = items.reduce((sum, i) => sum + i.quantity * i.price, 0);

    const updatedCart = await prisma.cart.update({
        where: { id: cart.id },
        data: { items, total }
    });

    return updatedCart;
};

const updateOrderType = async (userId, orderType) => {
    const cart = await prisma.cart.findUnique({ where: { userId } });
    if (!cart) throw new Error("Cart not found");

    return await prisma.cart.update({
        where: { id: cart.id },
        data: { orderType }
    });
};

const confirmOrder = async (userId, paymentMethod = 'CASH', providedBranchId = null) => {
    return await prisma.$transaction(async (tx) => {
        const cart = await tx.cart.findUnique({ where: { userId } });

        if (!cart || cart.items.length === 0) {
            throw new Error("Cart is empty");
        }

        let orderTotal = 0;
        const orderItems = [];
        let branchIdFromItems = null;

        for (const item of cart.items) {
            const product = await tx.product.findUnique({ where: { id: item.productId } });

            if (!product) {
                throw new Error(`${item.productName} not found`);
            }

            if (!product.isAvailable) {
                throw new Error(`${item.productName} is currently unavailable`);
            }

            // In a QSR, assume the cart belongs to a single branch. We take the branch from the first item.
            if (!branchIdFromItems) branchIdFromItems = product.branchId;

            const totalPrice = item.price * item.quantity;
            orderTotal += totalPrice;

            orderItems.push({
                productId: product.id,
                productName: item.productName,
                price: item.price,
                quantity: item.quantity,
                totalPrice
            });
        }

        const branchId = providedBranchId || branchIdFromItems;
        if (!branchId) throw new Error("Branch ID is required for order creation");

        const subtotal = orderTotal;
        const sgst = Number((subtotal * 0.09).toFixed(2));
        const cgst = Number((subtotal * 0.09).toFixed(2));
        const grandTotal = Number((subtotal + sgst + cgst).toFixed(2));

        const requestedMethod = (paymentMethod || 'CASH').toUpperCase();
        if (requestedMethod !== 'CASH') {
            if (process.env.ENFORCE_CASH_ONLY === 'true' || process.env.NODE_ENV === 'production') {
                const error = new Error("Online payments (UPI/CARD) are disabled. Only CASH checkout is supported at this time.");
                error.statusCode = 400;
                throw error;
            }
        }

        // Save order
        const order = await tx.order.create({
            data: {
                user: { connect: { id: userId } },
                branch: { connect: { id: branchId } },
                items: orderItems,
                orderTotal: grandTotal,
                orderType: cart.orderType || "DINE_IN",
                paymentMethod: requestedMethod,
                paymentStatus: 'pending', // Secure default: never trust client to mark as paid without gateway verification
                status: "RECEIVED"
            },
            include: {
                user: { select: { email: true, name: true } }
            }
        });

        // Clear cart
        await tx.cart.update({
            where: { id: cart.id },
            data: { items: [], total: 0 }
        });

        // Send order confirmation email
        if (order.user?.email) {
            sendOrderConfirmationEmail(
                order.user.email,
                order.user.name || 'Customer',
                order.id,
                orderTotal,
                orderItems
            );
        }

        return { message: "Order placed successfully 🎉", orderId: order.id };
    });
};

const buyNow = async (userId, productId, quantity, orderType = "TAKEAWAY") => {
    return await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error("Product not found");

        if (!product.isAvailable) {
            throw new Error("Product is currently unavailable");
        }

        const subtotal = product.price * quantity;
        const sgst = Number((subtotal * 0.09).toFixed(2));
        const cgst = Number((subtotal * 0.09).toFixed(2));
        const grandTotal = Number((subtotal + sgst + cgst).toFixed(2));

        const order = await tx.order.create({
            data: {
                user: { connect: { id: userId } },
                branch: { connect: { id: product.branchId } },
                items: [{
                    productId: product.id,
                    productName: product.name,
                    price: product.price,
                    quantity,
                    totalPrice: subtotal
                }],
                orderTotal: grandTotal,
                orderType: orderType,
                paymentMethod: 'CASH', // Default for Buy Now for now
                paymentStatus: 'pending',
                status: "RECEIVED"
            },
            include: {
                user: { select: { email: true, name: true } }
            }
        });

        // Send order confirmation email
        if (order.user?.email) {
            sendOrderConfirmationEmail(
                order.user.email,
                order.user.name || 'Customer',
                order.id,
                grandTotal,
                order.items
            );
        }

        return { message: "Order placed successfully 🎉", orderId: order.id };
    });
};

module.exports = {
    getCart,
    addOrUpdateItem,
    updateItemQuantity,
    removeItem,
    confirmOrder,
    buyNow,
    updateOrderType
};
