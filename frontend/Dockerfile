# ============================================
# Multi-stage Dockerfile for React Frontend
# ============================================

# Stage 1: Development
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# For development (override with docker-compose)
CMD ["npm", "run", "dev"]

# Stage 2: Production Build
FROM builder AS production-build

# Build for production
RUN npm run build

# ============================================
# Stage 2: Production (Nginx)
# ============================================

FROM nginx:alpine

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder
COPY --from=production-build /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]