const { z } = require("zod");

const productSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    price: z.preprocess((val) => Number(val), z.number().positive("Price must be a positive number")),
    category: z.string().min(1, "Category is required"),
    dietType: z.string().optional(),
    isAvailable: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    quantity: z.preprocess((val) => Number(val), z.number().int().nonnegative("Quantity cannot be negative")).optional(),
    imageUrl: z.string().url("Invalid image URL"),
    branchId: z.string().length(24, "Invalid Branch ID").nullable().optional(),
    id: z.string().optional()
});

const productUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    price: z.preprocess((val) => Number(val), z.number().positive()).optional(),
    category: z.string().min(1).optional(),
    dietType: z.string().optional(),
    isAvailable: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    quantity: z.preprocess((val) => Number(val), z.number().int().nonnegative()).optional(),
    imageUrl: z.string().url().optional(),
    branchId: z.string().length(24).optional()
});

const purchaseSchema = z.object({
    quantity: z.preprocess((val) => Number(val), z.number().int().positive("Purchase quantity must be at least 1"))
});

const restockSchema = z.object({
    // Kept quantity for basic restock backward compatibility, handles isAvailable automatically in controller/service
    quantity: z.preprocess((val) => Number(val), z.number().int().positive("Restock quantity must be at least 1")).optional(),
    isAvailable: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
});

module.exports = {
    productSchema,
    productUpdateSchema,
    purchaseSchema,
    restockSchema
};
