# MASTER SPECIFICATION & SPEC-DRIVEN DEVELOPMENT (SDD)
# Plataforma Universal de Domicilios, Mandados y Transporte (MVP+)

---

## 1. Resumen Ejecutivo y Enfoque de Producto (Customer & Courier Experience)

### 1.1. Propósito y Problemática Resuelta
La mayoría de las plataformas tradicionales de movilidad y entregas cobran comisiones abusivas (25%-35%), imponen tarifas algorítmicas opacas y sufren de fricciones bancarias. 

Esta plataforma es un **ecosistema logístico y de movilidad bajo demanda** enfocado en la agilidad, transparencia y costos mínimos de operación en ciudades intermedias y grandes de Latinoamérica. Opera bajo un modelo de intermediación tecnológica transparente con:
* **Costes Cero en APIs Externas ($0 API Cost):** Uso exclusivo de tecnologías Open Source (OpenStreetMap, MapLibre GL, OSRM autohospedado, Nominatim con caché inteligente Redis).
* **Negociación Libre y Transparente:** Subasta de tarifas en Domicilios y Transporte (el cliente propone, el conductor contraoferta o acepta).
* **Mandados de Alta Velocidad (Compras por Encargo):** Adjudicación directa al primer aceptante y coordinación por chat/llamada con liquidación en efectivo contra entrega.
* **Batching Inteligente de Corredor (Smart Corridor Routing):** Domiciliarios en ruta pueden tomar entregas adicionales si sus puntos caen dentro de un margen de 400 metros de su ruta activa, multiplicando sus ingresos por kilómetro recorrido.
* **Monetización Sencilla y Sin Pasarelas Costosas:** Billetera prepago para conductores donde la plataforma descuenta una micro-comisión fija/porcentual (ej. 10%) al completar el servicio vía código PIN (OTP). Las recargas se validan formalmente en la app mediante comprobantes Nequi/DaviPlata con aprobación en un clic por el administrador.

### 1.2. Arquetipos de Usuario y Recorridos Clave (User Journeys)
1. **El Cliente (Buscador de Rapidez y Precio Justo):**
   * Necesita enviar un paquete, pedir un mandado de tienda o trasladarse sin pagar tarifas dinámicas desproporcionadas.
   * Flujo: Abre la app -> Selecciona servicio -> Fija puntos con mapa interactivo y buscador optimizado -> Propone tarifa -> Recibe ofertas en tiempo real con foto, distancia y calificación -> Acepta conductor -> Coordina por chat/llamada interna -> Sigue la moto en vivo -> Entrega su PIN de seguridad de 4 dígitos -> Califica el servicio.
2. **El Domiciliario / Conductor (Maximizador de Ganancias y Seguridad):**
   * Busca rentabilizar su tiempo y vehículo sin perder el 30% en comisiones ni esperar pagos semanales retenidos.
   * Flujo: Se conecta -> Recibe alertas sonoras de alta prioridad en pantalla -> Acepta o contraoferta -> Si ya está en viaje, recibe alertas de "Pedido en tu ruta" (batching) -> Chatea y envía notas rápidas al cliente -> Llega a destino -> Solicita el PIN OTP de entrega -> Se debita automáticamente su comisión -> Si se queda sin saldo, recarga adjuntando comprobante Nequi/DaviPlata en la misma app.
3. **El Administrador (Control Operativo y Cumplimiento Legal):**
   * Monitorea la operación en tiempo real, valida documentos KYC de nuevos conductores, aprueba solicitudes de recarga de billetera en 1 clic, audita descargos legales y resuelve disputas/PQR con el historial de traza GPS.

---

## 2. Matriz de Funcionalidades: Diagnóstico y Brechas Resueltas

| Dominio Funcional | Especificación Inicial (Borrador) | Diagnóstico / Faltante Crítico | Especificación SDD Completa (Nueva) |
| :--- | :--- | :--- | :--- |
| **Mandados (Compras)** | Adjudicación directa y monto estimado de compra. | Sin mecanismo de manejo de diferencias de precio en tienda. | **Flujo Ágil con Chat:** Domiciliario confirma compra real por chat/llamada con foto del ticket; el excedente se liquida en efectivo al entregar con el PIN OTP. |
| **Comunicación en Ruta** | Mención aislada en sockets sin modelo ni UI. | Sin tabla de mensajes, sin fotos, sin notas rápidas, sin privacidad de número telefónico. | **Chat Interno WebSocket + Llamada:** Tabla `chat_messages` con estados de lectura, fotos de soporte, notas rápidas (*"Ya llegué"*, *"En camino"*) y botón directo de llamada. |
| **Recarga de Billetera** | Recarga manual verbal/externa por el admin. | Caótico e inauditable si se hace por WhatsApp externo. | **Módulo Formal de Recarga:** Domiciliario reporta monto, referencia y foto de comprobante Nequi/DaviPlata en tabla `topup_requests`. Admin aprueba/rechaza en 1 clic en Dashboard. |
| **Geocodificación y Búsqueda** | Solo mención a Nominatim libre. | Nominatim tiene rate-limit de 1 req/s; se bloquea con escritura rápida. | **Búsqueda Resiliente:** Debounce de 400ms + Capa de Caché en Redis para direcciones frecuentes + Geocodificación inversa con arrastre de pin en mapa. |
| **Ciclo de Vida de Órdenes** | Estados básicos (`SEARCHING`, `ACCEPTED`, `PICKED_UP`, etc.). | Faltan hitos reales como llegada a origen, cancelación con causales y penalizaciones. | **Máquina de Estados Robusta:** Incorpora `ARRIVED_AT_ORIGIN`, `PURCHASING` (mandados), causales de cancelación (`cancelled_by`, `cancellation_reason`) y expiración por timeout. |
| **Seguridad y Alertas** | Solo mención al color rojo para SOS. | Cero especificación de protocolos de emergencia y alertas sonoras de conducción. | **Botón SOS & Alertas de Conducción:** Generación de enlace web de seguimiento en vivo compartible a familiares/WhatsApp + Marcación de emergencia + Alertas hápticas y sonoras para motociclistas. |
| **Auditoría de Calificaciones** | Promedio directo en tabla `users`. | Imposible detectar calificaciones vengativas o comentarios fraudulentos. | **Tabla `order_ratings`:** Almacena estrellas (1-5), etiquetas contextuales (*"Puntual"*, *"Amable"*, *"Vehículo limpio"*) y comentarios vinculados a la orden. |
| **Testing y Calidad** | No contemplado en el borrador original. | Riesgo de regresión en cálculo espacial PostGIS, sockets y concurrencia. | **Batería Automatizada por Fases:** Pruebas unitarias Zod/Geometría, pruebas de integración de API/Sockets y pruebas E2E de flujo completo. |

---

## 3. Reglas Estrictas para el Agente de IA (Directivas de Ejecución)

1. **Ejecución Progresiva con Testing Gates:** El desarrollo se ejecuta paso a paso. Cada paso debe compilar limpiamente y superar sus pruebas automatizadas antes de pasar al siguiente.
2. **Costo Cero en Servicios Externos ($0 API Cost):** Estrictamente prohibido usar APIs de Google Maps, Mapbox pagado, Firebase Auth o pasarelas que cobren costo fijo por transacción. Todo el stack cartográfico es:
   * **Mapas:** OpenStreetMap con MapLibre GL (Móvil y Web) usando tiles libres CartoDB Positron / Voyager.
   * **Geocodificación:** Nominatim con capa intermedia de caché en Redis y control de tasa (rate-limit debounced).
   * **Ruteo y Geometría:** Instancia autohospedada de OSRM en Docker (`osrm/osrm-backend`).
3. **Código Único Universal:** Todo el frontend (Android `.apk`, iOS, PWA Cliente y Dashboard Web Administrativo) reside en `packages/app-universal` usando **React Native + Expo SDK 52+** con **Expo Router** 100% en **TypeScript**.
4. **Paridad Visual Absoluta:**
   * Utilizar **NativeWind v4** con tokens de diseño unificados en móvil y web.
   * Componentes nativos compartidos (`<UniversalMap />`, `<Button />`, `<Input />`, `<Card />`).
   * Único uso de `antd` restringido a tablas y reportes analíticos complejos en Web de escritorio (`Platform.OS === 'web'`).
5. **Robustez Concurrente en Mandados y Billetera:** Las adjudicaciones de mandados y los débitos de comisiones deben ejecutarse bajo transacciones ACID en PostgreSQL con bloqueos de fila (`SELECT ... FOR UPDATE`) o bloqueos distribuidos en Redis.

---

## 4. Sistema de Diseño Unificado (UI/UX, Design Tokens & Audio/Haptics)

### 4.1. Paleta de Colores Oficial (`packages/shared/src/theme/colors.ts`)
* **Primary (Brand Action - Ámbar/Naranja Intenso):** `#FF6B00` (Hover: `#E66000`, Light: `#FFF7ED`) — Botones de acción principal, botón de oferta, ruta activa en el mapa.
* **Secondary (Deep Slate - Azul Oscuro Corporativo):** `#0F172A` (Surface: `#1E293B`, Borders: `#334155`) — Barras de navegación, encabezados, pines de origen/destino.
* **Accent / Route Corridor (Cian Geoespacial):** `#06B6D4` (Fill: `rgba(6, 182, 212, 0.20)`) — Polígono del corredor inteligente de 400m y pedidos adicionales en tránsito.
* **Success (Verde Esmeralda):** `#10B981` (Surface: `#ECFDF5`) — Oferta aceptada, servicio completado, saldo positivo en billetera.
* **Warning (Amarillo Ámbar Alerta):** `#F59E0B` (Surface: `#FFFBEB`) — Contraoferta recibida, saldo bajo (< $5.000 COP), PQR abierta.
* **Danger (Rojo Carmesí):** `#EF4444` (Surface: `#FEF2F2`) — Botón SOS de pánico, cancelación de servicio, cuenta suspendida.
* **Neutrals & Backgrounds:**
  * Modo Claro (Cliente / Admin): Background `#F8FAFC`, Cards `#FFFFFF`, Bordes `#E2E8F0`, Texto `#0F172A`.
  * Modo Oscuro (Domiciliario en Noche): Background `#090D16`, Cards `#1E293B`, Bordes `#334155`, Texto `#F8FAFC`.

### 4.2. Estilo Cartográfico (Map Style Spec)
* **Tiles Cartográficos:** CartoDB Positron Raster/Vector tiles libres (`https://basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png`).
* **Polilínea Principal:** Color `#FF6B00`, grosor `5px`, terminación redondeada (`lineCap: 'round'`).
* **Polígono de Corredor Batching:** Línea exterior `#06B6D4` (`2px`), relleno translúcido `rgba(6, 182, 212, 0.18)`.
* **Marcador de Vehículo en Vivo:** Círculo pulsante con ícono de moto/auto orientado dinámicamente según el ángulo de rumbo (`bearing`).

### 4.3. Alertas Auditivas y Hápticas para Domiciliarios
* Al recibir una nueva solicitud o contraoferta: vibración continua (`Haptics.notificationAsync`) + sonido de timbre de alta prioridad (*chime* audible en tráfico).
* Alertas de Batching ("Pedido en tu ruta"): vibración corta doble + mensaje flotante *heads-up*.

---

## 5. Arquitectura del Monorepo y Stack Tecnológico

### 5.1. Estructura de Directorios del Monorepo
```text
/plataforma-logistica
├── package.json                   # NPM Workspaces config
├── docker-compose.yml             # Orquestación: Backend, PostGIS, Redis, OSRM
├── .github/workflows/deploy.yml   # Pipeline CI/CD a VPS vía SSH
├── packages/
│   ├── shared/                    # Código y Tipos 100% agnósticos de plataforma
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       ├── types/             # Interfaces de Usuario, Órdenes, Billetera, Chat, GPS
│   │       ├── schemas/           # Esquemas Zod para validación compartida (Auth, Bids, Orders)
│   │       ├── sockets/           # Nombres de eventos y payloads Socket.io tipados
│   │       └── theme/             # Tokens de diseño compartidos (colores, sombras, tipografías)
│   │
│   ├── backend/                   # API REST + WebSockets en Node.js + Express + TypeScript
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   ├── tests/                 # Pruebas Unitarias e Integración (Jest + Supertest)
│   │   └── src/
│   │       ├── server.ts          # Inicializador HTTP + Socket.io
│   │       ├── config/            # DB PostGIS (pg pool), Redis Client, OSRM URL, JWT
│   │       ├── modules/
│   │       │   ├── auth/          # Registro, Login, Aceptación Legal, Roles RBAC
│   │       │   ├── kyc/           # Subida de fotos Cédula/SOAT con Multer, Aprobación Admin
│   │       │   ├── services/      # Creación de Órdenes (Delivery, Errand, Transport), Lifecycle
│   │       │   ├── bidding/       # Motor de Subasta en vivo y Adjudicación Atómica
│   │       │   ├── routing/       # Cliente OSRM + Algoritmo espacial PostGIS Corridor Batching
│   │       │   ├── geocoding/     # Proxy Nominatim con debounce y caché Redis
│   │       │   ├── chat/          # Envío de mensajes, fotos y persistencia en DB
│   │       │   ├── wallet/        # Solicitudes de recarga, débito de comisiones, balances
│   │       │   ├── ratings/       # Calificaciones mutuas y estadísticas
│   │       │   └── pqr/           # Sistema de tickets, quejas e historial GPS
│   │       ├── sockets/           # Manejadores de conexión Socket.io (salas de orden, radar GPS)
│   │       └── middlewares/       # JWT Auth, Auditoría Legal, Error Handler, Rate Limiting
│   │
│   └── app-universal/             # Expo SDK 52+ Universal (Android, iOS, Web PWA y Admin)
│       ├── package.json
│       ├── app.json
│       ├── tailwind.config.js
│       ├── tsconfig.json
│       ├── src/
│       │   ├── app/               # Expo Router (Rutas basadas en sistema de archivos)
│       │   │   ├── _layout.tsx    # Layout raíz con Providers (Auth, Socket, Theme)
│       │   │   ├── index.tsx      # Redirección inteligente según rol y estado de sesión
│       │   │   ├── (auth)/        # Login, Registro, Términos Legales, KYC Upload
│       │   │   ├── (client)/      # Mapa solicitud, Negociador en vivo, Tracking, PIN OTP, Chat
│       │   │   ├── (courier)/     # Radar pedidos, Alerta corredor, GPS Foreground, Chat, Billetera
│       │   │   └── (admin)/       # Dashboard Web: Aprobación KYC, Recargas 1-clic, PQR, Mapa Flota
│       │   ├── components/        # UI Kit Reutilizable
│       │   │   ├── map/           # <UniversalMap />, Marcadores, Polilíneas, Polígono Corredor
│       │   │   ├── common/        # <Button />, <Input />, <Badge />, <Modal />, <Card />
│       │   │   └── chat/          # <ChatWindow />, <QuickReplies />, <EvidenceViewer />
│       │   ├── hooks/             # useAuth, useSocket, useOrderRealtime, useLocationTracker
│       │   ├── stores/            # Zustand stores (authStore, orderStore, activeServiceStore)
│       │   └── services/          # Cliente Axios, SocketClient, ExpoTaskManager (GPS Background)
```

---

## 6. Modelo de Datos Completo (PostgreSQL 16 + PostGIS 3.4)

```sql
-- Habilitación de extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Tabla Principal de Usuarios
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(20) NOT NULL CHECK (role IN ('CLIENT', 'COURIER', 'ADMIN')),
    full_name VARCHAR(120) NOT NULL,
    phone VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE,
    password_hash TEXT NOT NULL,
    status VARCHAR(30) DEFAULT 'ACTIVE' CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'BLOCKED')),
    rating_avg NUMERIC(3,2) DEFAULT 5.00,
    rating_count INT DEFAULT 0,
    wallet_balance NUMERIC(12,2) DEFAULT 0.00, -- Saldo prepago para conductores
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auditoría Legal de Aceptación de Términos (Blindaje)
CREATE TABLE legal_acceptances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    terms_version VARCHAR(20) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent TEXT,
    device_hash VARCHAR(128),
    clause_acknowledged BOOLEAN NOT NULL DEFAULT TRUE,
    accepted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Perfil y Documentación KYC del Domiciliario/Conductor
CREATE TABLE courier_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    vehicle_type VARCHAR(20) NOT NULL CHECK (vehicle_type IN ('MOTO', 'CAR', 'BICYCLE')),
    vehicle_plate VARCHAR(15),
    id_card_front_url TEXT NOT NULL,
    id_card_back_url TEXT NOT NULL,
    selfie_url TEXT NOT NULL,
    vehicle_doc_url TEXT,
    is_online BOOLEAN DEFAULT FALSE,
    active_orders_count INT DEFAULT 0 CHECK (active_orders_count >= 0 AND active_orders_count <= 3),
    current_location GEOGRAPHY(Point, 4326),
    current_bearing NUMERIC(5,2) DEFAULT 0.00, -- Ángulo de rumbo en grados
    active_route_corridor GEOGRAPHY(LineString, 4326), -- Geometría de la ruta activa para batching
    last_ping_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Solicitudes de Servicio (Órdenes)
CREATE TABLE service_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES users(id),
    courier_id UUID REFERENCES users(id),
    service_type VARCHAR(20) NOT NULL CHECK (service_type IN ('DELIVERY', 'ERRAND', 'TRANSPORT')),
    status VARCHAR(30) NOT NULL DEFAULT 'SEARCHING' 
        CHECK (status IN (
            'SEARCHING',          -- Buscando conductor / subasta abierta
            'ACCEPTED',           -- Conductor asignado / en camino al origen
            'ARRIVED_AT_ORIGIN',  -- Conductor llegó a punto de recogida o tienda
            'PURCHASING',         -- Comprando artículos (exclusivo para Mandados)
            'PICKED_UP',          -- Paquete recogido / Pasajero a bordo / Compras listas
            'IN_TRANSIT',         -- En ruta hacia el destino
            'COMPLETED',          -- Servicio finalizado exitosamente con PIN OTP
            'CANCELLED'           -- Cancelado por cliente, conductor o timeout
        )),
    origin_address TEXT NOT NULL,
    origin_point GEOGRAPHY(Point, 4326) NOT NULL,
    destination_address TEXT NOT NULL,
    destination_point GEOGRAPHY(Point, 4326) NOT NULL,
    description_notes TEXT,            -- Lista de compras o instrucciones del paquete
    estimated_purchase_cost NUMERIC(12,2) DEFAULT 0.00, -- Estimado para mandados
    offered_price NUMERIC(12,2) NOT NULL,               -- Valor propuesto por cliente
    agreed_price NUMERIC(12,2),                         -- Valor acordado tras subasta
    commission_amount NUMERIC(12,2) DEFAULT 0.00,       -- Comisión cobrada al conductor (ej. 10%)
    delivery_pin VARCHAR(4) NOT NULL,                   -- Código OTP secreto del cliente
    route_geometry GEOGRAPHY(LineString, 4326),         -- Traza calculada por OSRM
    estimated_distance_meters INT,
    estimated_duration_seconds INT,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. Subasta de Ofertas y Contraofertas en Vivo
CREATE TABLE order_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES users(id),
    bid_amount NUMERIC(12,2) NOT NULL,
    eta_minutes INT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Mensajería de Chat Interno en Tiempo Real
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    message_type VARCHAR(20) DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'QUICK_NOTE')),
    content TEXT NOT NULL,
    image_url TEXT,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Solicitudes Formales de Recarga de Billetera (Nequi / DaviPlata)
CREATE TABLE topup_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    courier_id UUID NOT NULL REFERENCES users(id),
    amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('NEQUI', 'DAVIPLATA', 'BANCOLOMBIA_QR', 'CASH_OFFICE')),
    reference_number VARCHAR(80) NOT NULL,
    voucher_url TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    admin_id UUID REFERENCES users(id),
    rejection_reason TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Libro Mayor de Transacciones de Billetera
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    courier_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES service_orders(id),
    topup_id UUID REFERENCES topup_requests(id),
    admin_id UUID REFERENCES users(id),
    tx_type VARCHAR(30) NOT NULL CHECK (tx_type IN ('TOPUP_CREDIT', 'COMMISSION_DEDUCTION', 'PENALTY', 'MANUAL_ADJUSTMENT')),
    amount NUMERIC(12,2) NOT NULL,
    balance_after NUMERIC(12,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Calificaciones y Reseñas Mutuas
CREATE TABLE order_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES users(id),
    rated_id UUID NOT NULL REFERENCES users(id),
    score INT NOT NULL CHECK (score >= 1 AND score <= 5),
    feedback_tags TEXT[], -- Ej. ARRAY['Puntual', 'Amable', 'Cuidadoso']
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_order_rating_direction UNIQUE (order_id, rater_id)
);

-- 10. Sistema de PQR e Incidentes con Auditoría GPS
CREATE TABLE pqr_tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id),
    reporter_id UUID NOT NULL REFERENCES users(id),
    reported_user_id UUID NOT NULL REFERENCES users(id),
    category VARCHAR(40) NOT NULL CHECK (category IN (
        'UNCOMPLETED_DELIVERY', 'DAMAGE_OR_LOSS', 'PRICE_DISPUTE', 'INAPPROPRIATE_BEHAVIOR', 'SECURITY_CONCERN', 'OTHER'
    )),
    description TEXT NOT NULL,
    evidence_urls TEXT[],
    status VARCHAR(20) DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_REVIEW', 'RESOLVED', 'DISMISSED')),
    admin_resolution_notes TEXT,
    resolution_action VARCHAR(30) CHECK (resolution_action IN ('NONE', 'WARNING_ISSUED', 'WALLET_REFUND', 'TEMP_SUSPENSION', 'PERMANENT_BAN')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices Espaciales PostGIS y Rendimiento Concurrente
CREATE INDEX idx_courier_location ON courier_profiles USING GIST (current_location);
CREATE INDEX idx_courier_corridor ON courier_profiles USING GIST (active_route_corridor);
CREATE INDEX idx_orders_origin ON service_orders USING GIST (origin_point);
CREATE INDEX idx_orders_dest ON service_orders USING GIST (destination_point);
CREATE INDEX idx_orders_status ON service_orders (status);
CREATE INDEX idx_chat_order ON chat_messages (order_id, created_at);
CREATE INDEX idx_topup_status ON topup_requests (status);
CREATE INDEX idx_bids_order_courier ON order_bids (order_id, courier_id);
```

---

## 7. Especificación Funcional Exhaustiva por Módulos

### Módulo 1: Autenticación, KYC y Blindaje Jurídico
* **Registro y Roles:** Registro con Teléfono, Contraseña, Nombre y Rol (`CLIENT`, `COURIER`).
* **Blindaje Legal Obligatorio:** Antes del primer uso, el usuario debe marcar la aceptación de Términos, Condiciones y Política de Datos. El sistema captura `ip_address`, `user_agent`, `device_hash` y guarda el registro inmutable en `legal_acceptances`.
* **Proceso KYC para Conductores:**
  * Subida de imágenes: Cédula (frente y reverso), Selfie con documento, Tarjeta de propiedad/SOAT y Placa.
  * Conductor queda en `PENDING_APPROVAL`. No puede conectarse ni recibir ofertas hasta que el Admin aprueba los documentos en el Dashboard.

### Módulo 2: Motor de Servicios y Subasta en Tiempo Real
* **Domicilios (Punto A a B con Subasta):**
  * Cliente elige origen y destino en el mapa, describe el paquete y propone una tarifa base.
  * Socket.io emite la orden a domiciliarios activos en un radio de 4 km.
  * Los domiciliarios aceptan la tarifa o envían una contraoferta. El cliente visualiza las tarjetas de oferta en tiempo real y selecciona la que prefiera.
* **Mandados (Compras por Encargo - Adjudicación Directa):**
  * Cliente ingresa la lista de compras, costo estimado de los artículos y tarifa ofrecida por la gestión.
  * **Adjudicación Atómica Directa:** El primer domiciliario que presione "Tomar Mandado" adquiere la orden mediante un bloqueo `SELECT ... FOR UPDATE` o Redis Lock. No requiere negociación previa.
  * **Manejo de Diferencias de Precio:** El domiciliario compra los productos, acuerda cualquier diferencia menor con el cliente a través del chat/llamada interna, y la diferencia se paga en efectivo en mano al momento de la entrega.
* **Transporte de Pasajeros:**
  * Negociación similar al domicilio pero marca al conductor como `OCCUPIED_EXCLUSIVE`, desactivando la recepción de pedidos en corredor hasta terminar el viaje.

### Módulo 3: Algoritmo de Batching Inteligente (Rutas en Corredor)
* **Condiciones de Activación:** Domiciliario en estado `IN_TRANSIT` llevando 1 o 2 pedidos (máximo 3 pedidos simultáneos).
* **Cálculo Espacial PostGIS:**
  Cuando un nuevo pedido (Origen $C$, Destino $D$) entra en estado `SEARCHING`, se evalúa contra las rutas activas de los conductores en tránsito:
  ```sql
  SELECT cp.user_id, cp.active_orders_count
  FROM courier_profiles cp
  WHERE cp.is_online = TRUE 
    AND cp.active_orders_count < 3
    AND cp.active_route_corridor IS NOT NULL
    -- Origen C y Destino D caen dentro de un buffer de 400m de la ruta activa
    AND ST_DWithin(cp.active_route_corridor, $point_C, 400)
    AND ST_DWithin(cp.active_route_corridor, $point_D, 400)
    -- Compatibilidad de sentido de marcha (el origen se visita antes que el destino)
    AND ST_LineLocatePoint(cp.active_route_corridor::geometry, $point_D::geometry) > 
        ST_LineLocatePoint(cp.active_route_corridor::geometry, $point_C::geometry);
  ```
* **Notificación de Corredor:** El domiciliario recibe un evento especial `socket:corridor_order_alert` con el mensaje: *"¡Pedido en tu ruta! +$X.XXX COP (Desvío < 400m)"*.

### Módulo 4: Comunicación, GPS en 2do Plano, OTP y Seguridad
* **Chat en Tiempo Real:** Canal WebSocket dedicado (`order:chat:${orderId}`) con persistencia en `chat_messages`. Permite texto, notas rápidas de un toque (*"Llegué al punto"*, *"Tienda cerrada"*, *"En camino"*) y envío de fotos (ej. ticket de compra).
* **GPS en Segundo Plano (Foreground Service Android):**
  * Implementado con `expo-location` y `expo-task-manager`.
  * Notificación persistente visible: *"Plataforma activa - Emitiendo ubicación de entrega"*.
  * Emisión de coordenadas al socket cada 4 segundos o cada 15 metros de desplazamiento.
* **Cierre de Entrega con PIN OTP (4 Dígitos):**
  * Al crearse la orden, se genera un código aleatorio de 4 dígitos visible únicamente en la app del cliente.
  * Para marcar la orden como `COMPLETED`, el domiciliario debe solicitar y digitar el PIN en su app.
  * La validación del PIN dispara automáticamente la transacción del libro mayor deduciendo la comisión de la plataforma.
* **Botón de Emergencia SOS:** Botón flotante accesible durante el servicio. Genera un enlace público web de seguimiento en tiempo real (`/tracking/[orderId]?token=xyz`) para compartir por WhatsApp a familiares, más botón de llamada directa al 123 (Policía Nacional).

### Módulo 5: Billetera Prepago y Recargas Nequi / DaviPlata
* **Flujo de Recarga en App:**
  1. El conductor entra a "Mi Billetera" -> "Recargar Saldo".
  2. La app muestra los datos y QR oficiales de la plataforma (Nequi, DaviPlata, Bancolombia).
  3. El conductor ingresa el valor pagado, el número de referencia y adjunta la foto/captura del comprobante.
  4. Se crea un registro en `topup_requests` con estado `PENDING`.
  5. El Administrador recibe notificación en el Dashboard Web, revisa la captura del comprobante y hace clic en **"Aprobar Recarga"**.
  6. El sistema incrementa `wallet_balance` en `users` y registra el movimiento de crédito en `wallet_transactions` de forma atómica.
* **Bloqueo por Saldo Insuficiente:** Si `wallet_balance <= 0`, el conductor no puede recibir nuevas solicitudes hasta recargar.

### Módulo 6: Dashboard Web Administrativo y Gestión de PQR
* **Aprobación de Conductores KYC:** Visualización de cédula, selfie y tarjeta de propiedad con botones de Aprobación / Rechazo con motivo.
* **Consola de PQR:** Clientes y conductores pueden reportar problemas sobre órdenes completadas o canceladas. El Admin revisa:
  * Traza GPS guardada del viaje.
  * Historial completo de mensajes del chat de la orden.
  * Tiempos de cada hito (creación, recogida, entrega).
  * Opciones: Archivar, advertencia, reembolso manual de saldo o bloqueo de cuenta.

---

## 8. Contratos de Eventos Socket.io

| Evento Socket | Emisor | Receptor | Payload Principal | Propósito |
| :--- | :--- | :--- | :--- | :--- |
| `order:new_available` | Servidor | Conductores en radio | `{ orderId, serviceType, origin, destination, offeredPrice, notes }` | Anuncio de pedido para subasta o toma directa. |
| `order:corridor_alert` | Servidor | Conductor específico | `{ orderId, extraEarnings, origin, destination, detourMeters }` | Alerta de pedido agrupado en corredor activo. |
| `bid:submit` | Conductor | Servidor | `{ orderId, bidAmount, etaMinutes }` | Envío de oferta o contraoferta. |
| `bid:received` | Servidor | Cliente de la orden | `{ bidId, courierId, courierName, rating, vehiclePlate, bidAmount, etaMinutes }` | Presentación de oferta en tiempo real al cliente. |
| `bid:accept` | Cliente | Servidor | `{ orderId, bidId }` | Selección y aceptación de oferta ganadora. |
| `order:assigned` | Servidor | Conductor y Cliente | `{ orderId, status: 'ACCEPTED', courier, client, deliveryPin (solo client) }` | Inicio formal del servicio y cierre de subasta. |
| `location:update` | Conductor | Servidor | `{ lat, lng, bearing, speed, orderIds: [] }` | Latido GPS persistente del conductor en tránsito. |
| `location:client_feed` | Servidor | Cliente | `{ lat, lng, bearing, etaSeconds }` | Posición en vivo de la moto en el mapa del cliente. |
| `chat:send` | Cliente / Conductor | Servidor | `{ orderId, messageType, content, imageUrl }` | Envío de mensaje o foto en el chat de la orden. |
| `chat:receive` | Servidor | Contraparte en orden | `{ id, senderId, messageType, content, imageUrl, createdAt }` | Recepción de mensaje en tiempo real. |
| `order:status_change` | Conductor / Servidor | Ambas partes | `{ orderId, newStatus, timestamp }` | Notificación de cambios de estado (`ARRIVED_AT_ORIGIN`, `PICKED_UP`, etc.). |
| `order:completed` | Servidor | Ambas partes | `{ orderId, completedAt, finalPrice }` | Validación exitosa de PIN OTP y finalización. |

---

## 9. Estrategia de Testing Automatizado (Test-Driven Gates)

Para asegurar cero fallas en producción, cada fase incluye sus correspondientes pruebas obligatorias:

1. **Pruebas Unitarias (Jest):**
   * Validación de esquemas Zod (`shared/src/schemas`).
   * Cálculo de comisiones y límites de billetera (`backend/src/modules/wallet`).
   * Generación y validación de PIN OTP criptográficamente seguro.
2. **Pruebas de Integración (Supertest + Base de Datos de Prueba PostGIS):**
   * Endpoint de Registro, Login y generación de token JWT.
   * Registro de auditoría de Términos y Condiciones en `legal_acceptances`.
   * Solicitud de recarga de billetera y aprobación por administrador con transacción ACID.
   * Consulta espacial PostGIS de corredor (`ST_DWithin` y `ST_LineLocatePoint`) con datos geoespaciales de prueba.
3. **Pruebas de Concurrencia y Sockets (Socket.io Mock Client):**
   * Bloqueo atómico de mandados: 2 conductores intentan tomar el mismo mandado simultáneamente; exactamente uno gana y el otro recibe error de orden no disponible.
   * Subasta en tiempo real: múltiples contraofertas y aceptación correcta por parte del cliente.
4. **Pruebas de Componentes UI (React Native Testing Library):**
   * Renderizado de `<UniversalMap />` con marcadores y polilínea.
   * Validación de formularios y modales de PIN OTP.

---

## 10. Plan Maestro de Trabajo por Fases (Ruta de Implementación)

### FASE 1: Cimientos del Monorepo, Infraestructura Docker y Base de Datos
* **Paso 1.1:** Inicializar monorepo NPM workspaces (`packages/shared`, `packages/backend`, `packages/app-universal`) con configuraciones de TypeScript y scripts globales.
* **Paso 1.2:** Implementar `packages/shared` con todos los tipos TypeScript, esquemas de validación Zod y tokens de diseño (`theme/colors.ts`).
* **Paso 1.3:** Crear `docker-compose.yml` orquestando:
  * `postgis/postgis:16-3.4` con el script SQL de migración inicial completo (Sección 6).
  * `redis:7-alpine` para caché y sincronización en tiempo real.
  * `osrm/osrm-backend` para ruteo local gratuito.
* **Paso 1.4:** Configurar pool de conexión PostgreSQL y cliente Redis en `packages/backend`, con test unitario de conexión y esquema.

### FASE 2: Backend Core — Autenticación, Blindaje Legal, Sockets y PostGIS
* **Paso 2.1:** Implementar módulo de Auth (Registro, Login JWT, Auditoría obligatoria en `legal_acceptances` y RBAC).
* **Paso 2.2:** Implementar módulo KYC (subida de archivos multipart con Multer para documentos del conductor).
* **Paso 2.3:** Implementar servidor Socket.io con autenticación JWT en el handshake y salas dinámicas por orden y ubicación de conductores.
* **Paso 2.4:** Implementar motor de subasta (`order_bids`), adjudicación atómica de mandados y ciclo de vida de órdenes (`service_orders`).
* **Paso 2.5:** Implementar módulo de Rutas Inteligentes (consulta PostGIS del corredor de 400m y cálculo de distancias con OSRM).
* **Paso 2.6:** Implementar módulo de Chat WebSocket persistente (`chat_messages`) con soporte de notas rápidas e imágenes.
* **Paso 2.7:** Implementar módulo de Billetera (solicitud formal de recarga `topup_requests`, aprobación en 1 clic y débito automático con validación de PIN OTP).
* **Paso 2.8:** Ejecutar y validar la suite de pruebas de integración del Backend (Supertest + Jest).

### FASE 3: App Universal — Sistema de Diseño, Mapa Universal y Autenticación
* **Paso 3.1:** Inicializar `packages/app-universal` con Expo SDK 52+, Expo Router y NativeWind v4 vinculado a los tokens de `packages/shared`.
* **Paso 3.2:** Construir el componente agnóstico `<UniversalMap />` (MapLibre GL en móvil y web) configurado con OpenStreetMap y estilos limpios CartoDB Positron.
* **Paso 3.3:** Crear el kit de componentes compartidos: botones con estados, inputs con validación Zod, tarjetas de orden, modal de PIN OTP y badge de estado.
* **Paso 3.4:** Implementar flujo de Autenticación en la app: Login, Registro por rol, Modal obligatorio de Aceptación Legal y Pantalla de Carga de Documentos KYC para conductores.

### FASE 4: Experiencia del Cliente y Domiciliario en Tiempo Real
* **Paso 4.1 (Módulo Cliente):** Pantalla interactiva para fijar origen/destino en el mapa con buscador de direcciones con debounce, selección de servicio, propuesta de tarifa, panel de contraofertas en vivo y visualización de PIN OTP.
* **Paso 4.2 (Módulo Domiciliario):** Radar de pedidos disponibles con alertas sonoras y hápticas, aceptación/contraoferta de tarifa, toma atómica de mandados y alerta visual de *"Pedido en tu ruta activa"*.
* **Paso 4.3 (GPS Background):** Configurar `expo-location` + `expo-task-manager` como servicio persistente en primer plano para emitir coordenadas con la pantalla bloqueada.
* **Paso 4.4 (Chat y Cierre de Entrega):** Interfaz de chat integrada en la orden activa con notas rápidas, envío de fotos de soporte y modal de ingreso de PIN OTP para finalizar el servicio y procesar la comisión.
* **Paso 4.5 (Seguridad SOS y Calificaciones):** Botón flotante SOS con enlace público compartible y pantalla de calificación mutua (estrellas y etiquetas).

### FASE 5: Dashboard Administrativo Web, PQR y Despliegue CI/CD
* **Paso 5.1 (Consola Admin Web):** Panel de escritorio en `(admin)` para:
  * Revisión y aprobación/rechazo de documentos KYC de conductores.
  * Gestión de solicitudes de recarga de billetera (Nequi/DaviPlata) con aprobación en 1 clic.
  * Consola de resolución de PQR con visualización de la traza GPS histórica y chat de la orden.
* **Paso 5.2 (PWA y Empaquetado APK):** Configuración de `manifest.json`, iconos y service worker para instalación como PWA en Web, y configuración de EAS Build para generar el archivo `.apk` de Android.
* **Paso 5.3 (CI/CD y VPS):** Pipeline de GitHub Actions para despliegue automatizado en VPS con Docker detrás de Cloudflare con WebSockets activos.
