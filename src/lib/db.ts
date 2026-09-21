import { PrismaClient } from '@prisma/client';

function getOptimizedDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL or DIRECT_URL environment variable is required. Please set it in your .env file.'
    );
  }
  if (url.includes('pgbouncer=true')) {
    if (!url.includes('connection_limit=')) {
      url += '&connection_limit=5';
    }
    if (!url.includes('pool_timeout=')) {
      url += '&pool_timeout=15';
    }
    if (!url.includes('connect_timeout=')) {
      url += '&connect_timeout=15';
    }
  }
  return url;
}

const dbUrl = getOptimizedDatabaseUrl();

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
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}

