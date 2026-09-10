const { prisma } = require('./client');

// Identifiers that reliably belong to one physical player and are safe to use
// for bridging between log entries (e.g. a kick embed that shows Discord +
// Steam + License + CitizenID together links all four together).
//
// SERVER_ID (session slot number) and IP are deliberately excluded: slots are
// reused across different players between sessions, and IPs are shared by
// households/VPNs, so linking on them would silently merge unrelated players.
// CHARACTER_NAME is a valid search entry point but not used to expand further,
// since renames/duplicate names are common.
const LINKABLE_TYPES = ['DISCORD', 'STEAM', 'LICENSE', 'LICENSE2', 'XBL', 'LIVE', 'FIVEM', 'CITIZENID'];

const MAX_HOPS = 5;
const MAX_IDENTIFIERS = 300;
const MAX_LOG_ENTRIES_PER_HOP = 50000;

/**
 * Given one known value (Discord ID, Steam ID, license, citizenid, name, ...),
 * walk the log entries that mention it and collect every other stable
 * identifier that ever co-occurred with it, transitively, up to MAX_HOPS.
 * This is what lets "search by Discord ID" also surface logs that only
 * recorded the player's license/citizenid, and vice versa.
 */
async function resolveIdentitySet(guildId, seedValue) {
  const known = new Map(); // value -> Set(types)
  const addKnown = (value, type) => {
    const v = String(value);
    if (!known.has(v)) known.set(v, new Set());
    known.get(v).add(type);
  };
  addKnown(seedValue, 'SEED');

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const values = [...known.keys()];

    const matched = await prisma.logIdentifier.findMany({
      where: { guildId, value: { in: values } },
      select: { logEntryId: true },
      distinct: ['logEntryId'],
      take: MAX_LOG_ENTRIES_PER_HOP,
    });
    if (matched.length === 0) break;

    const logEntryIds = matched.map((m) => m.logEntryId);

    const coOccurring = await prisma.logIdentifier.findMany({
      where: { guildId, logEntryId: { in: logEntryIds }, type: { in: LINKABLE_TYPES } },
      select: { type: true, value: true },
      distinct: ['type', 'value'],
      take: MAX_IDENTIFIERS,
    });

    let grew = false;
    for (const c of coOccurring) {
      if (!known.has(c.value)) grew = true;
      addKnown(c.value, c.type);
    }

    if (!grew || known.size >= MAX_IDENTIFIERS) break;
  }

  return [...known.entries()].map(([value, types]) => ({
    value,
    types: [...types].filter((t) => t !== 'SEED'),
  }));
}

async function lookupPlayer(guildId, seedValue, { page = 1, pageSize = 25 } = {}) {
  const identitySet = await resolveIdentitySet(guildId, seedValue);
  const values = identitySet.map((i) => i.value);

  const where = { guildId, identifiers: { some: { value: { in: values } } } };

  const [total, entries] = await Promise.all([
    prisma.logEntry.count({ where }),
    prisma.logEntry.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { fields: true, identifiers: true, channel: true },
    }),
  ]);

  return {
    identitySet,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    entries,
  };
}

async function searchCharacterNames(guildId, query, take = 15) {
  return prisma.logIdentifier.findMany({
    where: { guildId, type: 'CHARACTER_NAME', value: { contains: query } },
    distinct: ['value'],
    take,
    orderBy: { id: 'desc' },
  });
}

module.exports = { resolveIdentitySet, lookupPlayer, searchCharacterNames, LINKABLE_TYPES };
