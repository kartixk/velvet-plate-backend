const express = require("express");
const { authMiddleware, requireAdmin, requireStaff, optionalAuth } = require("../middleware/auth");
const branchController = require("../controllers/branchController");

const router = express.Router();

// Admin Only - Full Branch CRUD
router.get("/", authMiddleware, requireAdmin, branchController.getAllBranches);
router.post("/", authMiddleware, requireAdmin, branchController.createBranch);
router.put("/:id", authMiddleware, requireAdmin, branchController.updateBranch);
router.delete("/:id", authMiddleware, requireAdmin, branchController.deleteBranch);

const upload = require("../middleware/uploadMiddleware");

// ...

// Manager/Public Access
router.post("/onboard", authMiddleware, branchController.onboardBranch);
router.post("/upload", authMiddleware, upload.fields([
    { name: 'fssaiDoc', maxCount: 1 },
    { name: 'gstDoc', maxCount: 1 },
    { name: 'bankPassbook', maxCount: 1 },
    { name: 'managerPhoto', maxCount: 1 }
]), branchController.uploadDocuments);
router.put("/:id/visibility", authMiddleware, requireStaff, branchController.toggleVisibility);
router.put("/:id/verify", authMiddleware, requireAdmin, branchController.verifyBranch);

router.get("/my-branch", authMiddleware, branchController.getMyBranch);
router.get("/list/public", branchController.getPublicBranches);
router.get("/:id", optionalAuth, branchController.getBranchById); // Public view of a store

module.exports = router;
