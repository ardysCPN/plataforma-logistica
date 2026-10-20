# ⚡ Plataforma Logística Integral

> **Ecosistema Universal de Movilidad, Envíos Urbanos y Mandados en Tiempo Real**  
> Diseñado bajo una arquitectura de alto rendimiento, privacidad legal estricta y algoritmos geoespaciales con PostGIS.

---

## 🚀 Resumen del Proyecto

Plataforma logística monorepo diseñada para conectar clientes, conductores/repartidores y administradores en un flujo integral en tiempo real:

1. **Movilidad & Envíos por Subasta Dinámica:** Los usuarios solicitan traslados o envíos con precio base; los conductores pujan en vivo y el cliente selecciona la mejor oferta.
2. **Mandados Inteligentes:** Los repartidores adquieren productos solicitados por los clientes, coordinan detalles mediante chat multimedia en tiempo real y completan la entrega mediante verificación segura con **PIN OTP de 4 dígitos**.
3. **Corredores Geoespaciales PostGIS:** Algoritmo que calcula un buffer de 400 metros sobre la ruta activa de un conductor para asignarle mandados o paquetes que quedan en su trayecto (`ST_DWithin` / `ST_MakeLine`).
4. **Billetera Digital Prepago para Conductores:** Control de saldo y débito automático de comisión por servicio; recarga mediante comprobante Nequi/DaviPlata con aprobación en un clic desde el panel administrativo.
5. **App Universal Multiplataforma:** Una sola base de código construida sobre Expo SDK 52 que corre como **Portal Web SPA/PWA** (para navegadores de escritorio y móviles) y compila nativamente a **APK de Android** e iOS.

---

## 🏗️ Arquitectura del Monorepo

```
plataforma-logistica/
├── packages/
│   ├── shared/            # Modelos Zod, contratos Socket.io, tokens de diseño y utilidades compartidas
│   ├── backend/           # API REST Fastify, WebSockets Socket.io, PostGIS, Redis y JWT
│   └── app-universal/     # Aplicación universal Expo (Web, Android, iOS) con NativeWind v4
├── docker/
│   └── postgres/          # Scripts SQL de inicialización con extensiones PostGIS activadas
├── docker-compose.yml     # Orquestación completa local (PostgreSQL PostGIS, Redis, Backend, Web)
├── dokploy.compose.yml    # Configuración de despliegue en producción para Dokploy (VPS)
└── package.json           # Workspaces npm del monorepo
```

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías |
| :--- | :--- |
| **Monorepo** | npm workspaces, TypeScript 5.6 |
| **Backend** | Node.js, Fastify, Socket.io, PostgreSQL 16 + PostGIS 3.4, Redis 7, JWT |
| **Frontend Universal** | Expo SDK 52, React Native 0.76, React Native Web, NativeWind v4 (TailwindCSS), MapLibre GL, Zustand |
| **Geolocalización & Ruteo** | PostGIS (`ST_DWithin`, `ST_DistanceSphere`), OpenStreetMap, OSRM Engine |
| **DevOps & Despliegue** | Docker, Nginx (Alpine), Dokploy (VPS), Cloudflare DNS, EAS Build (Android APK) |

---

## 💻 Entorno de Desarrollo Local

### Requisitos Previos
- Node.js >= 20.x y npm >= 10.x
- Docker y Docker Desktop

### Opción 1: Todo en Docker (Un solo comando)
Levanta la base de datos PostGIS, Redis, Backend y Portal Web en contenedores locales:
```bash
docker compose up --build -d
```
- **Portal Web:** [http://localhost:8080](http://localhost:8080)
- **Backend API:** [http://localhost:3001](http://localhost:3001) (Healthcheck: `http://localhost:3001/health`)
- **PostgreSQL:** `localhost:5432`
- **Redis:** `localhost:6379`

### Opción 2: Modo Desarrollo con Hot-Reload
1. **Levantar las bases de datos:**
   ```bash
   docker compose up -d postgres redis
   ```
2. **Terminal 1 - Backend:**
   ```bash
   npm run dev:backend
   ```
3. **Terminal 2 - App Universal:**
   ```bash
   npm run dev:app
   ```
   *Abre tu navegador en [http://localhost:8081](http://localhost:8081).*

---

## 📱 Compilación Móvil (APK Android)

El proyecto incluye la configuración lista para compilar el APK de prueba o producción con **Expo Application Services (EAS)**:

```bash
cd packages/app-universal
eas login
eas build --platform android --profile preview
```

---

## 🌐 Despliegue en Producción (Dokploy)

El despliegue en servidor VPS con Dokploy se gestiona con `dokploy.compose.yml`:
- **API Backend:** Expuesto en puerto `3001` (subdominio ej. `domiapi.adhsolutions.tech`).
- **Portal Web:** Servido por Nginx en puerto `80` (subdominio ej. `domiapp.adhsolutions.tech`).

---

## 📄 Licencia

Uso privado y comercial exclusivo para **ADH Solutions**. Todos los derechos reservados.
