-- ==============================================================================
-- INIT DATABASE SCRIPT: Plataforma Universal de Domicilios, Mandados y Transporte
-- Especificación SDD Oficial - PostgreSQL 16 + PostGIS 3.4
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Tabla Principal de Usuarios
CREATE TABLE IF NOT EXISTS users (
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
CREATE TABLE IF NOT EXISTS legal_acceptances (
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
CREATE TABLE IF NOT EXISTS courier_profiles (
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
    current_bearing NUMERIC(5,2) DEFAULT 0.00, -- Rumbo en grados
    active_route_corridor GEOGRAPHY(LineString, 4326), -- Geometría de ruta activa para batching
    last_ping_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Solicitudes de Servicio (Órdenes)
CREATE TABLE IF NOT EXISTS service_orders (
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
    description_notes TEXT,
    estimated_purchase_cost NUMERIC(12,2) DEFAULT 0.00,
    offered_price NUMERIC(12,2) NOT NULL,
    agreed_price NUMERIC(12,2),
    commission_amount NUMERIC(12,2) DEFAULT 0.00,
    delivery_pin VARCHAR(4) NOT NULL,
    route_geometry GEOGRAPHY(LineString, 4326),
    estimated_distance_meters INT,
    estimated_duration_seconds INT,
    cancelled_by UUID REFERENCES users(id),
    cancellation_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- 5. Subasta de Ofertas y Contraofertas en Vivo
CREATE TABLE IF NOT EXISTS order_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES users(id),
    bid_amount NUMERIC(12,2) NOT NULL,
    eta_minutes INT,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Mensajería de Chat Interno en Tiempo Real
CREATE TABLE IF NOT EXISTS chat_messages (
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
CREATE TABLE IF NOT EXISTS topup_requests (
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
CREATE TABLE IF NOT EXISTS wallet_transactions (
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
CREATE TABLE IF NOT EXISTS order_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES service_orders(id) ON DELETE CASCADE,
    rater_id UUID NOT NULL REFERENCES users(id),
    rated_id UUID NOT NULL REFERENCES users(id),
    score INT NOT NULL CHECK (score >= 1 AND score <= 5),
    feedback_tags TEXT[],
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_order_rating_direction UNIQUE (order_id, rater_id)
);

-- 10. Sistema de PQR e Incidentes con Auditoría GPS
CREATE TABLE IF NOT EXISTS pqr_tickets (
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
CREATE INDEX IF NOT EXISTS idx_courier_location ON courier_profiles USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_courier_corridor ON courier_profiles USING GIST (active_route_corridor);
CREATE INDEX IF NOT EXISTS idx_orders_origin ON service_orders USING GIST (origin_point);
CREATE INDEX IF NOT EXISTS idx_orders_dest ON service_orders USING GIST (destination_point);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders (status);
CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_topup_status ON topup_requests (status);
CREATE INDEX IF NOT EXISTS idx_bids_order_courier ON order_bids (order_id, courier_id);
