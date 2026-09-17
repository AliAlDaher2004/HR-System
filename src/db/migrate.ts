import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

export async function runMigrations(customPglite?: PGlite) {
  const migrationPath = path.resolve(__dirname, 'migrations/0001_initial_schema.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running database migrations from:', migrationPath);

  if (customPglite) {
    await customPglite.exec(sql);
    console.log('Migrations applied successfully to PGlite instance.');
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl || process.env.USE_PGLITE === 'true') {
    const localDataDir = path.resolve(process.cwd(), './data/postgres.db');
    fs.mkdirSync(path.dirname(localDataDir), { recursive: true });
    const pglite = new PGlite(localDataDir);
    await pglite.exec(sql);
    console.log('Migrations applied successfully to local PostgreSQL engine.');
    return;
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('supabase.co') || databaseUrl.includes('pooler') 
      ? { rejectUnauthorized: false } 
      : undefined,
  });

  try {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log('Migrations applied successfully to PostgreSQL / Supabase.');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

// When run directly from CLI
if (require.main === module || process.argv[1]?.includes('migrate.ts')) {
  runMigrations()
    .then(() => {
      console.log('Database migration completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
