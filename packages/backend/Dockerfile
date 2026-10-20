# ==============================================================================
# DOCKERFILE BACKEND: Node.js 20 Alpine Multi-stage Build para Dokploy
# ==============================================================================

# 1. Build Stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar configuraciones base y workspaces
COPY package*.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/backend ./packages/backend
COPY packages/app-universal/package*.json ./packages/app-universal/

# Instalar dependencias y compilar paquetes TypeScript
RUN npm ci
RUN npm run build -w @plataforma/shared
RUN npm run build -w @plataforma/backend

# Podar dependencias de desarrollo para optimizar la imagen final
RUN npm prune --omit=dev

# 2. Production Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copiar package.json y distribuciones compiladas desde el builder
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

COPY packages/backend/package.json ./packages/backend/
COPY --from=builder /app/packages/backend/dist ./packages/backend/dist

# Copiar node_modules de producción optimizado desde el builder
COPY --from=builder /app/node_modules ./node_modules

# Crear directorio para subida de comprobantes KYC
RUN mkdir -p /app/uploads/kyc

EXPOSE 3001

CMD ["node", "packages/backend/dist/server.js"]
