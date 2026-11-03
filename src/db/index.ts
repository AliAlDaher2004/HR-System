import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';
import path from 'path';

// Singleton database instance preserved across Next.js dev reloads via globalThis
const globalForDb = globalThis as unknown as {
  dbInstance?: any;
  pgPoolInstance?: Pool | null;
  pgliteInstance?: PGlite | null;
};

export function getPglite(): PGlite {
  if (!globalForDb.pgliteInstance) {
    globalForDb.pgliteInstance = new PGlite();
  }
  return globalForDb.pgliteInstance;
}

export function getDb() {
  if (globalForDb.dbInstance) return globalForDb.dbInstance;

  const isTestEnv = process.env.NODE_ENV === 'test';
  const usePglite = process.env.USE_PGLITE === 'true';
  const databaseUrl = process.env.DATABASE_URL;

  if (isTestEnv && !process.env.FORCE_REMOTE_TEST_DB) {
    // Isolated automated testing mode using in-memory PostgreSQL WASM (PGlite)
    const pglite = getPglite();
    globalForDb.dbInstance = drizzlePglite(pglite, { schema });
    return globalForDb.dbInstance;
  }

  if (usePglite || !databaseUrl) {
    if (!globalForDb.pgliteInstance) {
      const localDataDir = path.resolve(process.cwd(), './data/postgres.db');
      const fs = require('fs');
      fs.mkdirSync(path.dirname(localDataDir), { recursive: true });
      globalForDb.pgliteInstance = new PGlite(localDataDir);
      globalForDb.pgliteInstance.exec(`
        ALTER TABLE attendance ADD COLUMN IF NOT EXISTS penalty_amount NUMERIC(12, 3) NOT NULL DEFAULT 0;
        ALTER TABLE attendance ADD COLUMN IF NOT EXISTS penalty_reason TEXT;
        ALTER TABLE attendance ADD COLUMN IF NOT EXISTS delivery_allowance NUMERIC(12, 3) NOT NULL DEFAULT 0;
        ALTER TABLE attendance ADD COLUMN IF NOT EXISTS delivery_reason TEXT;
        ALTER TABLE payroll ADD COLUMN IF NOT EXISTS delivery_allowance NUMERIC(12, 3) NOT NULL DEFAULT 0;
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS installment_months INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS monthly_installment NUMERIC(12, 3);
        ALTER TABLE loans ADD COLUMN IF NOT EXISTS start_month VARCHAR(7);
      `).catch(() => {});
    }
    globalForDb.dbInstance = drizzlePglite(globalForDb.pgliteInstance, { schema });
    return globalForDb.dbInstance;
  }

  if (!globalForDb.pgPoolInstance) {
    globalForDb.pgPoolInstance = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('pooler') 
        ? { rejectUnauthorized: false } 
        : undefined,
    });
  }

  globalForDb.dbInstance = drizzlePg(globalForDb.pgPoolInstance, { schema });
  return globalForDb.dbInstance;
}

export const db = getDb();
export { schema };
