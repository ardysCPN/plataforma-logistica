import bcrypt from 'bcryptjs';
import { db } from './database';

const DDL_STATEMENTS = `
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
    wallet_balance NUMERIC(12,2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auditoría Legal de Aceptación de Términos
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
    current_bearing NUMERIC(5,2) DEFAULT 0.00,
    active_route_corridor GEOGRAPHY(LineString, 4326),
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
            'SEARCHING', 'ACCEPTED', 'ARRIVED_AT_ORIGIN', 'PURCHASING',
            'PICKED_UP', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'
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

-- 7. Solicitudes de Recarga de Billetera
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

-- 10. Sistema de PQR e Incidentes
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

-- Índices Espaciales y de Búsqueda Concurrente
CREATE INDEX IF NOT EXISTS idx_courier_location ON courier_profiles USING GIST (current_location);
CREATE INDEX IF NOT EXISTS idx_courier_corridor ON courier_profiles USING GIST (active_route_corridor);
CREATE INDEX IF NOT EXISTS idx_orders_origin ON service_orders USING GIST (origin_point);
CREATE INDEX IF NOT EXISTS idx_orders_dest ON service_orders USING GIST (destination_point);
CREATE INDEX IF NOT EXISTS idx_orders_status ON service_orders (status);
CREATE INDEX IF NOT EXISTS idx_chat_order ON chat_messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS idx_bids_order_courier ON order_bids (order_id, courier_id);

-- 11. Columnas de Versión 1.0.4: Foto de Perfil y Detalle de Vehículo
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS vehicle_model VARCHAR(60);
ALTER TABLE courier_profiles ADD COLUMN IF NOT EXISTS vehicle_color VARCHAR(40);
`;

/**
 * Espera con reintentos hasta que PostgreSQL esté accesible
 */
async function waitForDatabase(maxRetries = 15, delayMs = 2000): Promise<boolean> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      const conn = await db.checkConnection();
      if (conn.connected) {
        console.log(`✅ Conexión establecida con PostgreSQL (PostGIS: ${conn.postgisVersion || 'activo'})`);
        return true;
      }
      console.warn(`⏳ [Intento ${i}/${maxRetries}] Esperando que la base de datos esté lista: ${conn.error}`);
    } catch (err: unknown) {
      console.warn(`⏳ [Intento ${i}/${maxRetries}] Esperando PostgreSQL...`);
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return false;
}

/**
 * Inserta los usuarios y registros semilla iniciales si la tabla de usuarios está vacía
 */
async function seedInitialData(): Promise<void> {
  const countRes = await db.query<{ count: string }>('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(countRes.rows[0]?.count || '0', 10);

  if (userCount > 0) {
    console.log(`ℹ️ La base de datos ya cuenta con ${userCount} usuarios registrados. Omitiendo seed.`);
    return;
  }

  console.log('🌱 Base de datos vacía detectada. Sembrando usuarios y perfiles iniciales...');

  const adminPass = await bcrypt.hash('Admin2026!*', 10);
  const clientPass = await bcrypt.hash('Cliente2026!*', 10);
  const courierPass = await bcrypt.hash('Conductor2026!*', 10);

  await db.transaction(async (client) => {
    // 1. Administrador Inicial
    const adminRes = await client.query(
      `INSERT INTO users (role, full_name, phone, email, password_hash, status)
       VALUES ('ADMIN', 'Administrador ADH', '3000000000', 'admin@adhsolutions.tech', $1, 'ACTIVE')
       RETURNING id`,
      [adminPass]
    );
    const adminId = adminRes.rows[0].id;

    await client.query(
      `INSERT INTO legal_acceptances (user_id, terms_version, ip_address, clause_acknowledged)
       VALUES ($1, '1.0', '127.0.0.1', TRUE)`,
      [adminId]
    );

    // 2. Cliente Demo Inicial
    const clientRes = await client.query(
      `INSERT INTO users (role, full_name, phone, email, password_hash, status)
       VALUES ('CLIENT', 'Cliente Demo ADH', '3001111111', 'cliente@adhsolutions.tech', $1, 'ACTIVE')
       RETURNING id`,
      [clientPass]
    );
    const clientId = clientRes.rows[0].id;

    await client.query(
      `INSERT INTO legal_acceptances (user_id, terms_version, ip_address, clause_acknowledged)
       VALUES ($1, '1.0', '127.0.0.1', TRUE)`,
      [clientId]
    );

    // 3. Conductor Demo Inicial
    const courierRes = await client.query(
      `INSERT INTO users (role, full_name, phone, email, password_hash, status, wallet_balance)
       VALUES ('COURIER', 'Carlos Conductor ADH', '3002222222', 'conductor@adhsolutions.tech', $1, 'ACTIVE', 50000.00)
       RETURNING id`,
      [courierPass]
    );
    const courierId = courierRes.rows[0].id;

    await client.query(
      `INSERT INTO courier_profiles (
         user_id, vehicle_type, vehicle_plate, id_card_front_url, id_card_back_url,
         selfie_url, is_online, current_location
       )
       VALUES (
         $1, 'MOTO', 'ADH-999', 'https://placeholder.co/id_front.jpg', 'https://placeholder.co/id_back.jpg',
         'https://placeholder.co/selfie.jpg', TRUE, ST_SetSRID(ST_MakePoint(-74.08175, 4.60971), 4326)
       )`,
      [courierId]
    );

    await client.query(
      `INSERT INTO legal_acceptances (user_id, terms_version, ip_address, clause_acknowledged)
       VALUES ($1, '1.0', '127.0.0.1', TRUE)`,
      [courierId]
    );

    // Registro inicial de saldo en billetera para el conductor
    await client.query(
      `INSERT INTO wallet_transactions (courier_id, admin_id, tx_type, amount, balance_after, notes)
       VALUES ($1, $2, 'TOPUP_CREDIT', 50000.00, 50000.00, 'Bono inicial de bienvenida para pruebas')`,
      [courierId, adminId]
    );

    // 4. Servicio / Mandado Demo Inicial en estado SEARCHING para pruebas en mapa
    await client.query(
      `INSERT INTO service_orders (
         client_id, service_type, status, origin_address, origin_point,
         destination_address, destination_point, description_notes,
         estimated_purchase_cost, offered_price, delivery_pin
       )
       VALUES (
         $1, 'ERRAND', 'SEARCHING',
         'Calle 72 # 10-34, Chapinero', ST_SetSRID(ST_MakePoint(-74.0573, 4.6565), 4326),
         'Carrera 15 # 85-20, Chicó', ST_SetSRID(ST_MakePoint(-74.0538, 4.6710), 4326),
         'Comprar medicamentos en Farmatodo y llevar recibo físico',
         25000.00, 12000.00, '4829'
       )`,
      [clientId]
    );
  });

  console.log('✨ Seed completado con éxito.');
  console.log('────────────────────────────────────────────────────────────────────────');
  console.log('🔑 CREDENCIALES INICIALES DE PRUEBA:');
  console.log('  👑 ADMIN:     Celular: 3000000000 | Clave: Admin2026!*     (admin@adhsolutions.tech)');
  console.log('  👤 CLIENTE:   Celular: 3001111111 | Clave: Cliente2026!*   (cliente@adhsolutions.tech)');
  console.log('  🛵 CONDUCTOR: Celular: 3002222222 | Clave: Conductor2026!* (conductor@adhsolutions.tech)');
  console.log('────────────────────────────────────────────────────────────────────────');
}

/**
 * Función principal de arranque: Auto-migración y Auto-seed
 */
export async function initializeDatabase(): Promise<boolean> {
  console.log('🔄 Verificando esquema e inicialización automática de la base de datos...');

  const isConnected = await waitForDatabase(10, 2000);
  if (!isConnected) {
    console.error('❌ No fue posible conectar con PostgreSQL tras varios intentos. El servidor continuará pero las consultas a la BD fallarán hasta que se restablezca.');
    return false;
  }

  try {
    console.log('🛠️ Ejecutando DDL (creación de extensiones, tablas e índices si no existen)...');
    await db.query(DDL_STATEMENTS);
    console.log('✅ Esquema verificado / migrado correctamente.');

    await seedInitialData();
    return true;
  } catch (error) {
    console.error('❌ Error durante la auto-migración o seed inicial:', error);
    return false;
  }
}
