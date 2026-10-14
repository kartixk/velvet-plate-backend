const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authMiddleware, requireAdmin } = require('../middleware/auth');

// Protect all admin routes with auth and admin guard
router.use(authMiddleware, requireAdmin);

router.get('/managers/pending', adminController.getPendingManagers);
router.put('/managers/:id/approve', adminController.approveManager);

module.exports = router;
