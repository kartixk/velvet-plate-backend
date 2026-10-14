const prisma = require("../prismaClient");
const { hashPassword, comparePassword, signToken } = require("./auth");
const { sendWelcomeEmail, sendManagerWelcomeEmail } = require("../utils/email");

const registerUser = async (data) => {
    const { email, password, name, phone, role } = data;

    // Reject any attempt to self-provision ADMIN role
    if (role && role.toUpperCase() === "ADMIN") {
        const error = new Error("Administrator accounts cannot be created via public registration");
        error.statusCode = 403;
        throw error;
    }

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
        throw new Error("Email already in use");
    }

    const hashed = await hashPassword(password);

    // Default to CUSTOMER. If MANAGER is requested, account requires administrative approval
    const assignedRole = (role && role.toUpperCase() === "MANAGER") ? "MANAGER" : "CUSTOMER";
    const isVerified = assignedRole === "CUSTOMER";

    const user = await prisma.user.create({
        data: {
            email,
            password: hashed,
            name,
            phone,
            role: assignedRole,
            isVerified
        }
    });

    // Never automatically issue privileged access / tokens to an unapproved account
    const token = isVerified ? signToken({ id: user.id, email: user.email, role: user.role }) : null;

    // Send Welcome Email
    if (user.role === "MANAGER") {
        sendManagerWelcomeEmail(user.email, user.name || "Partner");
    } else if (user.role === "CUSTOMER") {
        sendWelcomeEmail(user.email, user.name || "Customer");
    }

    return { user, token };
};

const loginUser = async (data) => {
    const { email, password } = data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error("User not found");
    }

    if (!user.isVerified) {
        throw new Error("Account pending admin approval");
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
        throw new Error("Invalid credentials");
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role });

    return { user, token };
};

const updateProfile = async (userId, data) => {
    const { name, phone } = data;
    return await prisma.user.update({
        where: { id: userId },
        data: { name, phone }
    });
};

module.exports = {
    registerUser,
    loginUser,
    updateProfile
};
