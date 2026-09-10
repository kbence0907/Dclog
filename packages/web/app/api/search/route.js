import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';
import { lookupPlayer } from '@dclog/db';

export async function GET(req) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const guildId = session.guildId || process.env.DISCORD_GUILD_ID;
  if (!guildId) return NextResponse.json({ error: 'no guild configured' }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get('query')?.trim();
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

  if (!query) return NextResponse.json({ error: 'missing query' }, { status: 400 });

  const result = await lookupPlayer(guildId, query, { page, pageSize: 20 });

  // BigInt ids don't survive JSON.stringify by default.
  const serialized = JSON.parse(
    JSON.stringify(result, (_key, value) => (typeof value === 'bigint' ? value.toString() : value))
  );

  return NextResponse.json(serialized);
}
