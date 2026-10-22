import { PrismaClient } from '@prisma/client';

function getPooledDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/hun_chatbot?schema=public';
  try {
    const url = new URL(databaseUrl);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT || '10');
    }
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch {
    return databaseUrl;
  }
}

// Un pool Prisma por proceso; evita que cada servicio abra su propio conjunto
// de conexiones contra PostgreSQL.
export const prisma = new PrismaClient({ datasources: { db: { url: getPooledDatabaseUrl() } } });
