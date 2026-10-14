const { authMiddleware } = require("../middleware/auth");
const reportService = require("../services/reportService");
const prisma = require("../prismaClient");

const getSalesReports = async (req, res, next) => {
    try {
        const userRole = (req.user.role || "").toUpperCase();
        if (userRole !== "ADMIN") {
            return res.status(403).json({ message: "Admins only" });
        }

        const { type = "day" } = req.query;
        const reports = await reportService.getSalesReports(type);

        res.json(reports);
    } catch (err) {
        next(err);
    }
};

const getBranchSalesReports = async (req, res, next) => {
    try {
        const userRole = (req.user?.role || "").toUpperCase();
        if (userRole !== "MANAGER" && userRole !== "ADMIN") {
            return res.status(403).json({ message: "Forbidden: Staff access (Admin or Manager) required" });
        }

        const { type = "day" } = req.query;
        const managerId = req.user.id || req.user._id;

        // First find the branch for this manager
        const branch = await prisma.branch.findUnique({
            where: { managerId }
        });

        if (!branch) {
            // No branch yet — return empty data instead of a 404 error
            return res.json({ count: 0, totalAmount: 0, sales: [] });
        }


        const reports = await reportService.getBranchSalesReports(branch.id, type);
        res.json(reports);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getSalesReports,
    getBranchSalesReports
};
