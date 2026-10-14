# Use official Node.js Alpine image
FROM node:22-alpine

# Prisma needs OpenSSL on Alpine
RUN apk add --no-cache openssl

# Set working directory
WORKDIR /app

# Copy package manifests first for caching
COPY package*.json ./

# Prisma schema must exist before npm ci (postinstall runs prisma generate)
COPY prisma ./prisma/

# Install production dependencies deterministically
RUN npm ci --omit=dev

# Copy application source
COPY . .

# Set ownership of application directory to pre-existing non-root node user
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Health check probe against shallow liveness route
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

# Expose server port
EXPOSE 5000

# Start application
CMD ["npm", "start"]
