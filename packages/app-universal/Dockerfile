# ==============================================================================
# DOCKERFILE WEB PORTAL: Expo Universal Web + Nginx (Debian Bookworm con glibc)
# ==============================================================================

# 1. Build Stage (Debian Bookworm con glibc nativo para LightningCSS, Sharp y Metro)
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Instalar herramientas básicas del sistema
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Configuración de memoria de Node y entorno de compilación
ENV NODE_OPTIONS="--max-old-space-size=4096"
ENV CI=1

ARG EXPO_PUBLIC_API_URL=https://domiapi.adhsolutions.tech
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}

# Copiar configuraciones base y definiciones de workspaces
COPY package*.json tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/app-universal/package*.json ./packages/app-universal/
COPY packages/backend/package*.json ./packages/backend/

# Instalar dependencias completas del monorepo
RUN npm ci

# Copiar código fuente
COPY packages/shared ./packages/shared
COPY packages/app-universal ./packages/app-universal

# Compilar librería compartida
RUN npm run build -w @plataforma/shared

# Compilar bundle de producción web con Expo
WORKDIR /app/packages/app-universal
RUN npx expo export -p web --max-workers 2

# 2. Production Stage con Nginx Alpine (sirve únicamente los archivos estáticos generados)
FROM nginx:alpine

COPY --from=builder /app/packages/app-universal/dist /usr/share/nginx/html
COPY packages/app-universal/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
