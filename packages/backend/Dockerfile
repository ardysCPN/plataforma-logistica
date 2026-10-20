# ==============================================================================
# DOCKERFILE BACKEND: Node.js 20 Alpine Multi-stage Build para Dokploy
# ==============================================================================

# 1. Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json y lockfiles del monorepo
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend

# Instalar dependencias y compilar
RUN npm ci
RUN npm run build -w @plataforma/shared
RUN npm run build -w @plataforma/backend

# 2. Production Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copiar configuraciones y dependencias del builder
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist
COPY packages/backend/package.json ./packages/backend/
COPY packages/backend/dist ./packages/backend/dist

# Instalar únicamente dependencias de producción
RUN npm ci --omit=dev

# Crear directorio para subida de comprobantes KYC
RUN mkdir -p /app/uploads/kyc

EXPOSE 3001

CMD ["node", "packages/backend/dist/server.js"]
