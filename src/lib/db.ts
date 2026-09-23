import { PrismaClient } from '@prisma/client';

function getOptimizedDatabaseUrl(): string {
  let url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) {
    // Graceful placeholder during Next.js build static analysis to prevent build-time crashes
    return 'postgresql://placeholder:placeholder@localhost:5432/postgres';
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

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: getOptimizedDatabaseUrl(),
      },
    },
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}


