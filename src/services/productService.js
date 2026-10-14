const prisma = require("../prismaClient");

const toTitleCase = (str = "") =>
    str
        .toLowerCase()
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const getAllProducts = async (branchId = null) => {
    let whereCondition = {};
    if (branchId) {
        whereCondition = {
            OR: [
                { branchId: branchId },
                { branchId: null }
            ],
            // Optimization: Filter out products that are specifically deleted for this branch
            branchStatuses: {
                none: {
                    branchId: branchId,
                    isDeleted: true
                }
            }
        };
    }

    const products = await prisma.product.findMany({
        where: whereCondition,
        orderBy: { createdAt: "desc" },
        include: {
            branch: { select: { name: true } },
            ...(branchId ? { branchStatuses: { where: { branchId } } } : {})
        }
    });

    return products.map((p) => {
        // If a branch override exists for this product, use its availability
        const status = p.branchStatuses && p.branchStatuses.length > 0 ? p.branchStatuses[0] : null;
        const isAvailable = status ? status.isAvailable : p.isAvailable;
        const isDeleted = status ? status.isDeleted : false;

        return {
            ...p,
            _id: p.id,
            branchName: p.branch?.name || "Global",
            isAvailable,
            isDeleted,
            quantity: isAvailable ? 1 : 0
        };
    }).filter(p => !p.isDeleted); // Safety filter remains but DB does most of the work
};

const upsertProduct = async (data) => {
    const formattedName = toTitleCase(data.name);

    const isAvailable = data.isAvailable !== undefined ? data.isAvailable === "true" || data.isAvailable === true : true;

    const price = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
    const branchId = data.branchId === "" ? null : data.branchId;

    const product = await prisma.product.upsert({
        where: {
            id: data.id || "000000000000000000000000"
        },
        update: {
            name: formattedName,
            description: data.description || null,
            price: price,
            category: data.category,
            dietType: data.dietType || "Veg",
            isAvailable: isAvailable,
            imageUrl: data.imageUrl,
            branchId: branchId
        },
        create: {
            name: formattedName,
            description: data.description || null,
            price: price,
            category: data.category,
            dietType: data.dietType || "Veg",
            isAvailable: isAvailable,
            imageUrl: data.imageUrl,
            branchId: branchId
        },
    });
    return product;
};

const updateProductById = async (id, data) => {
    const updateData = { ...data };
    if (updateData.name) {
        updateData.name = toTitleCase(updateData.name);
    }

    if (updateData.isAvailable !== undefined) {
        updateData.isAvailable = updateData.isAvailable === "true" || updateData.isAvailable === true;
    }

    // Remove old 'quantity' references if passed by frontend
    if ('quantity' in updateData) delete updateData.quantity;

    const updatedProduct = await prisma.product.update({
        where: { id },
        data: updateData,
    });

    return updatedProduct;
};

const deleteProductById = async (id, branchId = null, role = "ADMIN") => {
    if (role === "MANAGER" && branchId) {
        // Manager can only unlink global products from their branch
        // or delete branch-specific products entirely (if they created it exclusively for their branch)
        const product = await prisma.product.findUnique({ where: { id } });

        if (product && product.branchId === branchId) {
            // It's a localized product created just for this branch, safe to delete entirely
            await prisma.product.delete({ where: { id } });
        } else {
            // It's a global product, only unlink via BranchItemStatus override
            await prisma.branchItemStatus.upsert({
                where: {
                    branchId_productId: {
                        branchId,
                        productId: id
                    }
                },
                update: { isAvailable: false },
                create: {
                    branchId,
                    productId: id,
                    isAvailable: false
                }
            });
        }
    } else if (role === "ADMIN") {
        // Admin deletes the product globally
        await prisma.product.delete({ where: { id } });
    } else {
        const error = new Error("Forbidden: Unauthorized role for product deletion");
        error.statusCode = 403;
        throw error;
    }
};

const purchaseProduct = async (productId, userId, quantityToBuy) => {
    return await prisma.$transaction(async (tx) => {
        const product = await tx.product.findUnique({ where: { id: productId } });

        if (!product || !product.isAvailable) {
            throw new Error("Purchase failed: product is currently unavailable or not found");
        }

        const totalPrice = product.price * quantityToBuy;

        const updatedProduct = product;

        let branchId = product.branchId;
        if (!branchId) {
            const firstBranch = await tx.branch.findFirst({ select: { id: true } });
            if (firstBranch) {
                branchId = firstBranch.id;
            }
        }

        if (!branchId) {
            throw new Error("No branch available for order creation");
        }

        await tx.order.create({
            data: {
                user: { connect: { id: userId } },
                branch: { connect: { id: branchId } },
                orderTotal: totalPrice,
                orderType: "TAKEAWAY", // Default for direct purchase
                status: "RECEIVED",
                items: [
                    {
                        productId: product.id,
                        productName: product.name,
                        price: product.price,
                        quantity: quantityToBuy,
                        totalPrice: totalPrice,
                    }
                ]
            },
        });

        return updatedProduct;
    });
};

const setProductAvailability = async (productId, isAvailable, branchId = null) => {
    if (branchId) {
        // Update or create branch-specific status override
        const statusRecord = await prisma.branchItemStatus.upsert({
            where: {
                branchId_productId: {
                    branchId,
                    productId
                }
            },
            update: { isAvailable },
            create: {
                branchId,
                productId,
                isAvailable
            }
        });
        return statusRecord;
    } else {
        // Update global fallback (Admin level)
        const product = await prisma.product.update({
            where: { id: productId },
            data: { isAvailable: isAvailable },
        });
        return product;
    }
};

// Kept for backwards compatibility but changed to availability
const restockProduct = async (productId, quantity) => {
    return setProductAvailability(productId, true);
};

module.exports = {
    getAllProducts,
    upsertProduct,
    updateProductById,
    deleteProductById,
    purchaseProduct,
    restockProduct,
    setProductAvailability
};
