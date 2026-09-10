const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { prisma } = require('@dclog/db');
const { saveMessageLogs } = require('../db/saveLog');

const BATCH_SIZE = 100;
const DELAY_MS = 350; // stay comfortably under Discord's message-fetch rate limit
const PROGRESS_EVERY = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Walks a channel's full history backwards from `lastBackfilledMessageId`
 * (or from "now" on first run), saving every log embed it finds. Runs in the
 * background and reports progress into the channel that requested it, since
 * a server with 400+ hours of logs can easily mean tens of thousands of
 * messages and take well over Discord's 15-minute interaction token window.
 */
async function runBackfill(client, channelId, statusChannelId) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) return;

  const record = await prisma.logChannel.findUnique({ where: { id: channelId } });
  if (!record) return;

  let before = record.lastBackfilledMessageId || undefined;
  let totalMessages = 0;
  let totalEntries = 0;

  const reportProgress = async (text) => {
    const statusChannel = await client.channels.fetch(statusChannelId).catch(() => null);
    await statusChannel?.send(text).catch(() => {});
  };

  while (true) {
    const batch = await channel.messages.fetch({ limit: BATCH_SIZE, before }).catch((err) => {
      console.error('[backfill] fetch failed:', err);
      return null;
    });
    if (!batch || batch.size === 0) break;

    for (const message of batch.values()) {
      try {
        totalEntries += await saveMessageLogs(message, record);
      } catch (err) {
        console.error(`[backfill] failed on message ${message.id}:`, err);
      }
      totalMessages++;
    }

    before = batch.last().id;
    await prisma.logChannel.update({ where: { id: channelId }, data: { lastBackfilledMessageId: before } });

    if (totalMessages % PROGRESS_EVERY === 0) {
      await reportProgress(
        `⏳ Backfill folyamatban <#${channelId}>: ${totalMessages} üzenet feldolgozva (${totalEntries} log bejegyzés).`
      );
    }

    if (batch.size < BATCH_SIZE) break;
    await sleep(DELAY_MS);
  }

  await prisma.logChannel.update({ where: { id: channelId }, data: { backfillComplete: true } });
  await reportProgress(`✅ Backfill kész <#${channelId}>: összesen ${totalMessages} üzenet, ${totalEntries} log bejegyzés elmentve.`);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backfill')
    .setDescription('Régi logok visszamenőleges begyűjtése egy csatornából')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc
        .setName('start')
        .setDescription('Backfill indítása (vagy folytatása, ha félbeszakadt)')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Log csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('status')
        .setDescription('Backfill állapota')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Log csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const channel = interaction.options.getChannel('channel');

    const record = await prisma.logChannel.findUnique({ where: { id: channel.id } });
    if (!record) {
      await interaction.reply({
        content: `❌ **#${channel.name}** nincs regisztrálva log csatornaként. Előbb: \`/logchannel add\`.`,
        ephemeral: true,
      });
      return;
    }

    if (sub === 'start') {
      await interaction.reply({
        content: `🚀 Backfill elindítva **#${channel.name}** csatornán a háttérben. Sok üzenetnél ez akár órákig is eltarthat, státuszt ide fogok küldeni.`,
        ephemeral: true,
      });
      runBackfill(interaction.client, channel.id, interaction.channelId).catch((err) => {
        console.error('[backfill] fatal error:', err);
      });
    } else if (sub === 'status') {
      await interaction.reply({
        content:
          `**#${channel.name}** backfill állapot: ${record.backfillComplete ? '✅ kész' : '⏳ folyamatban / nem indult'}\n` +
          `Utolsó feldolgozott üzenet ID: ${record.lastBackfilledMessageId || 'nincs'}`,
        ephemeral: true,
      });
    }
  },
};
