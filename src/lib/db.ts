import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  process.env.DIRECT_URL ||
  'postgresql://postgres.guhhzkrkmfqzvqcgdsya:NRHHcSuurAde6yRz@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

function createPrismaClient(): PrismaClient {
  try {
    if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
      const pool = new Pool({
        connectionString,
        ssl: { rejectUnauthorized: false },
      });
      const adapter = new PrismaPg(pool);
      return new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
      });
    }
  } catch (err) {
    console.error('Error initializing PrismaPg adapter, falling back:', err);
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
