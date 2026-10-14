const { z } = require("zod");

const cartItemSchema = z.object({
    productId: z.string().min(1, "Product ID is required").optional(),
    sweetId: z.string().min(1).optional(),
    quantity: z.preprocess((val) => Number(val), z.number().int().min(1, "Quantity must be at least 1"))
}).refine(data => data.productId || data.sweetId, { message: "ProductID or sweetId is required" });

const buyNowSchema = z.object({
    productId: z.string().min(1, "Product ID is required").optional(),
    sweetId: z.string().min(1).optional(),
    quantity: z.preprocess((val) => Number(val), z.number().int().min(1, "Quantity must be at least 1")),
    orderType: z.enum(["DINE_IN", "TAKEAWAY"]).optional()
}).refine(data => data.productId || data.sweetId, { message: "ProductID or sweetId is required" });

const updateQuantitySchema = z.object({
    quantity: z.preprocess((val) => Number(val), z.number().int().min(1, "Quantity must be at least 1"))
});

const orderTypeSchema = z.object({
    orderType: z.enum(["DINE_IN", "TAKEAWAY"], {
        errorMap: () => ({ message: "orderType must be either DINE_IN or TAKEAWAY" })
    })
});

module.exports = {
    cartItemSchema,
    buyNowSchema,
    updateQuantitySchema,
    orderTypeSchema
};
