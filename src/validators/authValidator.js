const { z } = require("zod");

const registerSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    name: z.string().min(1, "Name is required").optional(),
    phone: z.string().min(1, "Phone number is required"),
    role: z.enum(["CUSTOMER", "MANAGER"]).optional()
});

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required")
});

module.exports = {
    registerSchema,
    loginSchema
};
