const { extractIdentifiers } = require('@dclog/db');

/**
 * Turns a Discord message from a log channel into one record per embed
 * (a single webhook post can carry several embeds), ready to persist.
 * Falls back to plain message content for non-embed log lines.
 */
function parseMessage(message) {
  const records = [];
  const embeds = message.embeds || [];

  if (embeds.length === 0) {
    if (!message.content) return records;
    const identifiers = extractIdentifiers({ description: message.content, fields: [] });
    records.push({
      embedIndex: 0,
      webhookName: message.author?.username || null,
      title: null,
      description: message.content.slice(0, 8000),
      color: null,
      timestamp: message.createdAt,
      rawJson: { content: message.content },
      fields: [],
      identifiers,
    });
    return records;
  }

  embeds.forEach((embed, idx) => {
    const fields = (embed.fields || []).map((f) => ({ name: f.name, value: f.value, inline: !!f.inline }));
    const identifiers = extractIdentifiers({
      title: embed.title,
      description: embed.description,
      fields,
      footerText: embed.footer?.text,
      authorName: embed.author?.name,
    });

    records.push({
      embedIndex: idx,
      webhookName: message.author?.username || embed.author?.name || null,
      title: embed.title ? embed.title.slice(0, 500) : null,
      description: embed.description ? embed.description.slice(0, 8000) : null,
      color: embed.color ?? null,
      timestamp: embed.timestamp ? new Date(embed.timestamp) : message.createdAt,
      rawJson: typeof embed.toJSON === 'function' ? embed.toJSON() : embed,
      fields,
      identifiers,
    });
  });

  return records;
}

module.exports = { parseMessage };
