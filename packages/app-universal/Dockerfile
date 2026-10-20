# Multi-stage Dockerfile for Expo Universal Web Portal
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations and workspace definitions
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/app-universal/package*.json ./packages/app-universal/
COPY packages/backend/package*.json ./packages/backend/

# Install dependencies
RUN npm ci

# Copy source codes
COPY packages/shared ./packages/shared
COPY packages/app-universal ./packages/app-universal

# Build shared library
RUN npm run build -w @plataforma/shared

# Build Expo Web production bundle
WORKDIR /app/packages/app-universal
RUN npm run export:web

# Production serving stage with Nginx
FROM nginx:alpine

COPY --from=builder /app/packages/app-universal/dist /usr/share/nginx/html
COPY packages/app-universal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
