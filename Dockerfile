# Use official Node.js Alpine image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package manifests first for caching
COPY package*.json ./

# Install production dependencies deterministically
RUN npm ci --omit=dev

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

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
