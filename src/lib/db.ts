import { PrismaClient } from '@prisma/client';

const fallbackUrl =
  'postgresql://postgres.guhhzkrkmfqzvqcgdsya:NRHHcSuurAde6yRz@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL || fallbackUrl;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

