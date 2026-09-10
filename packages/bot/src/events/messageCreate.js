const { prisma } = require('@dclog/db');
const { saveMessageLogs } = require('../db/saveLog');

module.exports = async function onMessageCreate(message) {
  if (!message.guildId) return;
  // Log channels are fed by webhooks (or bots); ignore regular member chatter.
  if (!message.webhookId && !message.author?.bot) return;

  try {
    const channel = await prisma.logChannel.findUnique({ where: { id: message.channelId } });
    if (!channel || !channel.enabled) return;
    await saveMessageLogs(message, channel);
  } catch (err) {
    console.error(`[messageCreate] failed to save log for message ${message.id}:`, err);
  }
};
