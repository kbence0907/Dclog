const { prisma } = require('@dclog/db');
const { parseMessage } = require('../parser/embedParser');

/**
 * Persists every embed found in a message. Idempotent via the
 * (messageId, embedIndex) unique constraint, so re-processing the same
 * message during a backfill/live overlap is always safe.
 */
async function saveMessageLogs(message, channelRecord) {
  const records = parseMessage(message);
  if (!records.length) return 0;

  for (const rec of records) {
    await prisma.logEntry.upsert({
      where: { messageId_embedIndex: { messageId: message.id, embedIndex: rec.embedIndex } },
      update: {},
      create: {
        messageId: message.id,
        embedIndex: rec.embedIndex,
        channelId: channelRecord.id,
        guildId: channelRecord.guildId,
        webhookName: rec.webhookName,
        title: rec.title,
        description: rec.description,
        color: rec.color,
        timestamp: rec.timestamp,
        rawJson: rec.rawJson,
        fields: {
          create: rec.fields.map((f) => ({
            name: (f.name || '').slice(0, 255),
            value: (f.value || '').slice(0, 4000),
            inline: !!f.inline,
          })),
        },
        identifiers: {
          create: rec.identifiers.map((i) => ({
            guildId: channelRecord.guildId,
            type: i.type,
            value: i.value.slice(0, 191),
          })),
        },
      },
    });
  }

  return records.length;
}

module.exports = { saveMessageLogs };
