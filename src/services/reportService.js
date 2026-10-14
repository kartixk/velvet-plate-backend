const prisma = require("../prismaClient");

const getSalesReports = async (type) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    end.setHours(23, 59, 59, 999);

    switch (type) {
        case "day":
            start.setHours(0, 0, 0, 0);
            break;
        case "week":
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            break;
        case "month":
            start.setMonth(start.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        case "year":
            start.setFullYear(start.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        case "all":
            start = new Date("2000-01-01T00:00:00Z");
            break;
        default:
            start.setHours(0, 0, 0, 0);
    }

    const orders = await prisma.order.findMany({
        where: {
            createdAt: {
                gte: start,
                lte: end
            },
            status: { not: "CANCELLED" }
        },
        select: {
            id: true,
            status: true,
            orderTotal: true,
            createdAt: true,
            orderType: true,
            items: true,
            branchId: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const totalAmount = orders.reduce((sum, s) => sum + (Number(s.orderTotal) || 0), 0);
    const totalCommission = totalAmount * 0.15;

    return {
        count: orders.length,
        totalAmount,
        totalCommission,
        sales: orders // Keeping the response key "sales" to not break frontend reports initially
    };
};

const getBranchSalesReports = async (branchId, type) => {
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    end.setHours(23, 59, 59, 999);

    switch (type) {
        case "day":
            start.setHours(0, 0, 0, 0);
            break;
        case "month":
            start.setMonth(start.getMonth() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        case "year":
            start.setFullYear(start.getFullYear() - 1);
            start.setHours(0, 0, 0, 0);
            break;
        default:
            start.setHours(0, 0, 0, 0);
    }

    const orders = await prisma.order.findMany({
        where: {
            branchId,
            createdAt: {
                gte: start,
                lte: end
            },
            status: { not: "CANCELLED" }
        },
        select: {
            id: true,
            status: true,
            orderTotal: true,
            createdAt: true,
            orderType: true,
            items: true,
            branchId: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const totalAmount = orders.reduce((sum, s) => sum + (Number(s.orderTotal) || 0), 0);
    const totalCommission = totalAmount * 0.15;

    return {
        count: orders.length,
        totalAmount,
        totalCommission,
        sales: orders
    };
};

module.exports = {
    getSalesReports,
    getBranchSalesReports
};
