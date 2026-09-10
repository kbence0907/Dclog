const { SlashCommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const { prisma } = require('@dclog/db');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('logchannel')
    .setDescription('Log csatornák kezelése')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc
        .setName('add')
        .setDescription('Log csatorna hozzáadása')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('remove')
        .setDescription('Log csatorna eltávolítása')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sc) => sc.setName('list').setDescription('Log csatornák listázása')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    await prisma.guild.upsert({
      where: { id: guildId },
      update: {},
      create: { id: guildId, name: interaction.guild?.name },
    });

    if (sub === 'add') {
      const channel = interaction.options.getChannel('channel');
      await prisma.logChannel.upsert({
        where: { id: channel.id },
        update: { enabled: true, name: channel.name },
        create: { id: channel.id, guildId, name: channel.name },
      });
      await interaction.reply({
        content: `✅ **#${channel.name}** hozzáadva log csatornaként. Régi logok begyűjtéséhez: \`/backfill start\`.`,
        ephemeral: true,
      });
    } else if (sub === 'remove') {
      const channel = interaction.options.getChannel('channel');
      await prisma.logChannel.updateMany({ where: { id: channel.id }, data: { enabled: false } });
      await interaction.reply({ content: `🛑 **#${channel.name}** eltávolítva a log csatornák közül.`, ephemeral: true });
    } else if (sub === 'list') {
      const channels = await prisma.logChannel.findMany({ where: { guildId } });
      if (!channels.length) {
        await interaction.reply({ content: 'Még nincs beállított log csatorna.', ephemeral: true });
        return;
      }
      const lines = channels.map(
        (c) => `${c.enabled ? '🟢' : '🔴'} <#${c.id}> ${c.backfillComplete ? '(backfill kész)' : '(backfill hiányzik)'}`
      );
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
  },
};
