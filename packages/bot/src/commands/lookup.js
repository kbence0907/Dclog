const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { lookupPlayer } = require('@dclog/db');

const PAGE_SIZE = 5;

function buildResultEmbed(result, query) {
  const knownList = result.identitySet
    .slice(0, 15)
    .map((i) => (i.types.length ? `\`${i.value}\` (${i.types.join('/')})` : `\`${i.value}\``))
    .join(', ');

  const embed = new EmbedBuilder()
    .setTitle(`🔎 Keresés: ${query}`)
    .setColor(0x5865f2)
    .setDescription(`**Ismert azonosítók:** ${knownList || 'nincs'}\n**Összes találat:** ${result.total} log bejegyzés`)
    .setFooter({ text: `Oldal ${result.page}/${result.pageCount}` });

  for (const entry of result.entries) {
    const fieldsText =
      entry.fields.slice(0, 5).map((f) => `**${f.name}:** ${f.value}`).join('\n') || entry.description?.slice(0, 300) || '—';
    const channelLabel = entry.channel?.name || `#${entry.channelId}`;
    embed.addFields({
      name: `${entry.title || 'Log'} • ${channelLabel} (<#${entry.channelId}>) • <t:${Math.floor(new Date(entry.timestamp).getTime() / 1000)}:R>`,
      value: fieldsText.slice(0, 1024),
    });
  }

  return embed;
}

function buildRow(query, page, pageCount) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`lookup:${encodeURIComponent(query)}:${page - 1}`)
      .setLabel('◀ Előző')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId(`lookup:${encodeURIComponent(query)}:${page + 1}`)
      .setLabel('Következő ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= pageCount)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lookup')
    .setDescription('Játékos keresése a logokban azonosító vagy karakternév alapján')
    .addStringOption((o) =>
      o.setName('query').setDescription('Discord ID, license, steam ID, citizenid vagy karakternév').setRequired(true)
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString('query').trim();
    const result = await lookupPlayer(interaction.guildId, query, { page: 1, pageSize: PAGE_SIZE });

    if (result.total === 0) {
      await interaction.editReply({ content: `❌ Nem található log bejegyzés ehhez: \`${query}\`` });
      return;
    }

    await interaction.editReply({
      embeds: [buildResultEmbed(result, query)],
      components: [buildRow(query, result.page, result.pageCount)],
    });
  },

  async handleButton(interaction) {
    const [, encodedQuery, pageStr] = interaction.customId.split(':');
    const query = decodeURIComponent(encodedQuery);
    const page = parseInt(pageStr, 10);

    await interaction.deferUpdate();
    const result = await lookupPlayer(interaction.guildId, query, { page, pageSize: PAGE_SIZE });

    await interaction.editReply({
      embeds: [buildResultEmbed(result, query)],
      components: [buildRow(query, result.page, result.pageCount)],
    });
  },
};
