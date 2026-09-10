const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { prisma } = require('@dclog/db');
const { saveMessageLogs } = require('../db/saveLog');

const BATCH_SIZE = 100;
const DELAY_MS = 350; // stay comfortably under Discord's message-fetch rate limit
const PROGRESS_EVERY = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Guards against starting two overlapping backfill loops on the same channel
// (e.g. someone running /backfill start twice, or start + startall together),
// which would race on `lastBackfilledMessageId` and duplicate work.
const runningChannels = new Set();

/**
 * Walks a channel's full history backwards from `lastBackfilledMessageId`
 * (or from "now" on first run), saving every log embed it finds. Runs in the
 * background and reports progress into the channel that requested it, since
 * a server with 400+ hours of logs can easily mean tens of thousands of
 * messages and take well over Discord's 15-minute interaction token window.
 */
async function runBackfill(client, channelId, statusChannelId) {
  if (runningChannels.has(channelId)) return { skipped: true, totalMessages: 0, totalEntries: 0 };
  runningChannels.add(channelId);

  const reportProgress = async (text) => {
    const statusChannel = await client.channels.fetch(statusChannelId).catch(() => null);
    await statusChannel?.send(text).catch(() => {});
  };

  try {
    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return { skipped: true, totalMessages: 0, totalEntries: 0 };

    const record = await prisma.logChannel.findUnique({ where: { id: channelId } });
    if (!record) return { skipped: true, totalMessages: 0, totalEntries: 0 };

    let before = record.lastBackfilledMessageId || undefined;
    let totalMessages = 0;
    let totalEntries = 0;

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
    return { skipped: false, totalMessages, totalEntries };
  } finally {
    runningChannels.delete(channelId);
  }
}

/**
 * Runs backfill sequentially over every log channel of a guild that isn't
 * marked complete yet — the convenience path for "just get everything we
 * already have into the system" across many log channels at once.
 */
async function runBackfillAll(client, guildId, statusChannelId) {
  const channels = await prisma.logChannel.findMany({
    where: { guildId, enabled: true, backfillComplete: false },
  });

  if (!channels.length) {
    const statusChannel = await client.channels.fetch(statusChannelId).catch(() => null);
    await statusChannel?.send('ℹ️ Nincs olyan log csatorna, aminél a backfill még hátra lenne.').catch(() => {});
    return;
  }

  let doneCount = 0;
  for (const ch of channels) {
    const result = await runBackfill(client, ch.id, statusChannelId);
    if (!result.skipped) doneCount++;
  }

  const statusChannel = await client.channels.fetch(statusChannelId).catch(() => null);
  await statusChannel
    ?.send(`🏁 Összes backfill kész: ${doneCount}/${channels.length} log csatorna feldolgozva.`)
    .catch(() => {});
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('backfill')
    .setDescription('Régi logok visszamenőleges begyűjtése egy csatornából')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc
        .setName('start')
        .setDescription('Backfill indítása (vagy folytatása, ha félbeszakadt) egy csatornán')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Log csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc.setName('startall').setDescription('Backfill indítása az összes még hátralévő log csatornán')
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

    if (sub === 'startall') {
      const channels = await prisma.logChannel.findMany({
        where: { guildId: interaction.guildId, enabled: true, backfillComplete: false },
      });
      if (!channels.length) {
        await interaction.reply({
          content: 'ℹ️ Minden regisztrált log csatorna backfillje már kész, vagy még nincs egy csatorna sem beállítva (`/logchannel add`).',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: `🚀 Backfill elindítva a háttérben **${channels.length}** log csatornán (${channels
          .map((c) => `<#${c.id}>`)
          .join(', ')}), egyesével, sorban. Nagy csatornáknál órákig is eltarthat, státuszt ide fogok küldeni.`,
        ephemeral: true,
      });
      runBackfillAll(interaction.client, interaction.guildId, interaction.channelId).catch((err) => {
        console.error('[backfill] fatal error:', err);
      });
      return;
    }

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
      if (record.backfillComplete) {
        await interaction.reply({
          content: `ℹ️ **#${channel.name}** backfillje már kész. Ha mégis van új anyag, a bot élőben úgyis gyűjti a bejövő logokat.`,
          ephemeral: true,
        });
        return;
      }
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
