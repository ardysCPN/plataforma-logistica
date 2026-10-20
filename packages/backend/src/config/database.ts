import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';

export const pool = new Pool(
  env.DATABASE_URL && env.DATABASE_URL.trim() !== ''
    ? {
        connectionString: env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: env.DB_HOST,
        port: env.DB_PORT,
        user: env.DB_USER,
        password: env.DB_PASSWORD,
        database: env.DB_NAME,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

pool.on('error', (err) => {
  console.error('❌ Error inesperado en el pool de PostgreSQL:', err);
});

export const db = {
  query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>> => {
    return pool.query<T>(text, params);
  },

  getClient: (): Promise<PoolClient> => {
    return pool.connect();
  },

  /**
   * Ejecuta un callback dentro de una transacción ACID segura
   */
  transaction: async <T>(callback: (client: PoolClient) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  /**
   * Verifica la conectividad con PostgreSQL y la disponibilidad de PostGIS
   */
  checkConnection: async (): Promise<{ connected: boolean; postgisVersion?: string; error?: string }> => {
    try {
      const res = await pool.query('SELECT PostGIS_Version() AS postgis_version;');
      return {
        connected: true,
        postgisVersion: res.rows[0]?.postgis_version,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        connected: false,
        error: errorMessage,
      };
    }
  },
};
