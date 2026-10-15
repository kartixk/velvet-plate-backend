const express = require("express");
const cors = require("cors");
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
const logger = require('./utils/logger');

const config = require('./config/env');

const app = express();

// Trust proxy: on Vercel (VERCEL=1 is set by the platform) trust exactly one hop by default.
// An explicit TRUST_PROXY (validated in config/env.js) always wins; elsewhere the default stays untrusted.
const defaultTrustProxy = process.env.VERCEL ? 1 : false;
app.set('trust proxy', process.env.TRUST_PROXY ? config.trustProxy : defaultTrustProxy);

// Disable Express fingerprint header
app.disable('x-powered-by');

// Security headers: permit cross-origin static uploads for frontend SPA
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);

const isDev = process.env.NODE_ENV !== 'production';

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 10_000 : 100,       // essentially unlimited in dev
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,               // completely skip in development
});

// Stricter limiter only enforced in production
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDev ? 10_000 : 20,
    message: 'Too many login attempts from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isDev,               // completely skip in development
});

// Use morgan to log HTTP requests via our winston logger
// const morganFormat = isDev ? "dev" : "combined";
// app.use(
//     morgan(morganFormat, {
//         stream: {
//             write: (message) => logger.info(message.trim()),
//         },
//     })
// );

const path = require('path');
// CORS_ORIGIN accepts a comma-separated list; local dev origins are always allowed.
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://velvet-plate.vercel.app',
  ...(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean),
];
app.use(
  cors({
    origin: (origin, cb) => {
      // No Origin header = same-origin / server-to-server / curl
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Health check probe (mounted BEFORE rate limiters so orchestrator and Render health checks are never throttled)
app.use("/api/health", require("./routes/health"));

app.use('/api', limiter);

// Swagger API Documentation (disabled in production unless explicitly enabled)
const { setupSwagger } = require('./config/swagger');
setupSwagger(app);
app.use("/api/cart", require("./routes/cart"));
app.use("/api/support", require("./routes/supportRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/products", require("./routes/products"));
app.use("/api/branches", require("./routes/branchRoutes"));
app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/reports", require("./routes/reports"));

app.get("/", (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER !== 'true') {
        return res.status(200).send('Server Ready 🍬');
    }
    res.send('Server Ready 🍬 | <a href="/api-docs">Interactive Swagger API Documentation</a>');
});

app.all("*", (req, res, next) => {
    const AppError = require('./utils/AppError');
    next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

module.exports = app;
