import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const { searchParams } = new URL(req.url);
    const secretParam = searchParams.get('key');
    const expectedSecret = process.env.CRON_SECRET;

    // Optional security: If CRON_SECRET is configured, check Bearer token or ?key= query param
    if (
      expectedSecret &&
      authHeader !== `Bearer ${expectedSecret}` &&
      secretParam !== expectedSecret
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();

    // Execute a direct SQL query against PostgreSQL on Supabase to keep database active
    const result = await db.$queryRaw<Array<{ keepalive: number }>>`SELECT 1 as keepalive;`;
    const latencyMs = Date.now() - startTime;

    return NextResponse.json(
      {
        success: true,
        status: 'active',
        database: 'connected',
        latencyMs,
        timestamp: new Date().toISOString(),
        result,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[CRON KEEP-ALIVE ERROR]:', error);
    return NextResponse.json(
      {
        success: false,
        status: 'error',
        message: error?.message || 'Database query failed',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
