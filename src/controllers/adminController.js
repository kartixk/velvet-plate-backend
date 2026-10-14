const adminService = require("../services/adminService");

const getPendingManagers = async (req, res, next) => {
    try {
        const managers = await adminService.getPendingManagers();
        res.status(200).json({ managers });
    } catch (err) {
        next(err);
    }
};

const approveManager = async (req, res, next) => {
    try {
        const { id } = req.params;
        const manager = await adminService.approveManager(id);
        res.status(200).json({
            message: "Manager approved successfully",
            manager: { id: manager.id, name: manager.name, email: manager.email }
        });
    } catch (err) {
        if (err.message === "Manager not found" || err.message === "User is not a manager" || err.message === "Manager is already verified") {
            return res.status(400).json({ error: err.message });
        }
        next(err);
    }
};

module.exports = {
    getPendingManagers,
    approveManager
};
