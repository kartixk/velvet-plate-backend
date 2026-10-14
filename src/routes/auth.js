const express = require('express');
const router = express.Router();
const { validate } = require("../middleware/validate");
const { loginSchema, registerSchema } = require("../validators/authValidator");
const authController = require("../controllers/authController");
const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs for auth routes
  message: { message: 'Too many registration attempts. Please try again later.' }
});


const { authMiddleware } = require('../middleware/auth');

router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);
router.put('/profile', authMiddleware, authController.updateProfile);

module.exports = router;