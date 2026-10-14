const productService = require("../services/productService");
const prisma = require("../prismaClient");

const getAllProducts = async (req, res, next) => {
    try {
        const { branchId } = req.query;
        const products = await productService.getAllProducts(branchId);
        res.status(200).json(products);
    } catch (err) {
        next(err);
    }
};

const upsertProduct = async (req, res, next) => {
    try {
        const role = (req.user?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "MANAGER") {
            return res.status(403).json({ message: "Forbidden: Staff access required" });
        }

        const productData = { ...req.body };

        if (role === 'MANAGER') {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { managedBranch: true }
            });
            if (!user || !user.managedBranch) {
                return res.status(403).json({ message: "Manager does not have an assigned branch." });
            }
            // Enforce that manager can only create products for their assigned branch
            productData.branchId = user.managedBranch.id;
        }

        const product = await productService.upsertProduct(productData);
        res.status(201).json(product);
    } catch (err) {
        next(err);
    }
};

const updateProductById = async (req, res, next) => {
    try {
        const role = (req.user?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "MANAGER") {
            return res.status(403).json({ message: "Forbidden: Staff access required" });
        }

        if (role === 'MANAGER') {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { managedBranch: true }
            });
            if (!user || !user.managedBranch) {
                return res.status(403).json({ message: "Manager does not have an assigned branch." });
            }

            const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
            if (!existing) {
                return res.status(404).json({ message: "Product not found" });
            }

            if (existing.branchId && existing.branchId !== user.managedBranch.id) {
                return res.status(403).json({ message: "Forbidden: You cannot modify products belonging to another branch." });
            }

            if (!existing.branchId && role !== 'ADMIN') {
                return res.status(403).json({ message: "Forbidden: Only administrators can modify global products." });
            }
        }

        const updatedProduct = await productService.updateProductById(req.params.id, req.body);
        res.status(200).json(updatedProduct);
    } catch (err) {
        next(err);
    }
};

const deleteProductById = async (req, res, next) => {
    try {
        const role = (req.user?.role || "").toUpperCase();
        if (role !== "ADMIN" && role !== "MANAGER") {
            return res.status(403).json({ message: "Forbidden: Staff access required" });
        }

        let branchIdToUpdate = null;

        if (role === 'MANAGER') {
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { managedBranch: true }
            });
            if (!user || !user.managedBranch) {
                return res.status(403).json({ message: "Manager does not have an assigned branch." });
            }
            branchIdToUpdate = user.managedBranch.id;

            const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
            if (!existing) {
                return res.status(404).json({ message: "Product not found" });
            }
            if (existing.branchId && existing.branchId !== user.managedBranch.id) {
                return res.status(403).json({ message: "Forbidden: You cannot delete products belonging to another branch." });
            }
        }

        await productService.deleteProductById(req.params.id, branchIdToUpdate, role);
        res.status(200).json({ message: "Product deleted/unlinked successfully" });
    } catch (err) {
        next(err);
    }
};

const purchaseProduct = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;
        const { quantity } = req.body;

        const updatedProduct = await productService.purchaseProduct(req.params.id, userId, quantity);

        res.status(200).json({
            message: `Successfully purchased ${quantity} ${updatedProduct.name}`
        });
    } catch (err) {
        if (err.message.includes("insufficient stock")) {
            return res.status(400).json({ message: err.message });
        }
        next(err);
    }
};

const restockProduct = async (req, res, next) => {
    try {
        const { quantity } = req.body;
        const product = await productService.restockProduct(req.params.id, quantity);

        res.status(200).json({ message: "Restocked successfully", product });
    } catch (err) {
        if (err.code === 'P2025') {
            return res.status(404).json({ message: "Product not found" });
        }
        next(err);
    }
};

const updateAvailability = async (req, res, next) => {
    try {
        const { isAvailable } = req.body;
        // Verify user role
        const role = req.user.role.toUpperCase();

        let branchIdToUpdate = null;

        if (role === 'MANAGER') {
            // Fetch the user to get their managed branch since it's not in the basic JWT payload
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                include: { managedBranch: true }
            });

            if (!user || !user.managedBranch) {
                return res.status(403).json({ message: "Manager does not have an assigned branch." });
            }
            branchIdToUpdate = user.managedBranch.id;
        } else if (role === 'ADMIN') {
            // Admin updates the global product status (branchId = null)
            branchIdToUpdate = null;
        } else {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const updatedProduct = await productService.setProductAvailability(req.params.id, isAvailable, branchIdToUpdate);
        res.status(200).json(updatedProduct);

    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllProducts,
    upsertProduct,
    updateProductById,
    deleteProductById,
    purchaseProduct,
    restockProduct,
    updateAvailability
};
