const prisma = require("../prismaClient");
const { sendUrgentUplinkEmail } = require("../utils/email");

const triggerUplink = async (req, res, next) => {
    try {
        const userId = req.user.id || req.user._id;

        // Fetch user and branch details for context
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { managedBranch: true }
        });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // Validate payload length if provided
        if (req.body && req.body.message && typeof req.body.message === 'string' && req.body.message.length > 1000) {
            return res.status(400).json({ error: "Message exceeds maximum allowed length of 1000 characters" });
        }

        // Find all Admins to notify
        const admins = await prisma.user.findMany({
            where: { role: 'ADMIN' },
            select: { email: true }
        });

        const managerName = user.name || "Partner";
        const managerEmail = user.email;
        const storeName = user.managedBranch?.name || "Unassigned Store";
        const referenceId = userId.slice(-8).toUpperCase();

        // Send the email to all registered Admins (email utility swallows errors gracefully)
        if (admins.length > 0) {
            await Promise.all(admins.map(admin =>
                sendUrgentUplinkEmail(admin.email, managerEmail, managerName, storeName, referenceId)
            ));
        } else {
            // Fallback to default support if no admins found in DB
            await sendUrgentUplinkEmail('partners@velvetplate.com', managerEmail, managerName, storeName, referenceId);
        }

        // Return non-leaking, sanitized confirmation
        res.status(200).json({
            message: "Urgent uplink protocol initiated successfully. Admin team notified.",
            referenceId
        });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    triggerUplink
};
