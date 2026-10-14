const winston = require('winston');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'sweet-shop-backend' },
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ],
});

// Serverless filesystems are read-only: file transports only outside production.
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
}

module.exports = logger;
