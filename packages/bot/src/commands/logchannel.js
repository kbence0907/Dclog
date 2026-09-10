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
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Egyedi címke, ha a csatorna neve nem árulja el mit logol (pl. "Halál", "Sebzés", "Bank")')
            .setRequired(false)
        )
    )
    .addSubcommand((sc) =>
      sc
        .setName('rename')
        .setDescription('Egy már hozzáadott log csatorna címkéjének módosítása')
        .addChannelOption((o) =>
          o.setName('channel').setDescription('Csatorna').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
        .addStringOption((o) => o.setName('name').setDescription('Új címke').setRequired(true))
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
      const label = interaction.options.getString('name')?.trim() || channel.name;
      await prisma.logChannel.upsert({
        where: { id: channel.id },
        update: { enabled: true, name: label },
        create: { id: channel.id, guildId, name: label },
      });
      await interaction.reply({
        content: `✅ **#${channel.name}** hozzáadva log csatornaként${label !== channel.name ? ` (\`${label}\` néven)` : ''}. Régi logok begyűjtéséhez: \`/backfill start\`.`,
        ephemeral: true,
      });
    } else if (sub === 'rename') {
      const channel = interaction.options.getChannel('channel');
      const label = interaction.options.getString('name').trim();
      const record = await prisma.logChannel.findUnique({ where: { id: channel.id } });
      if (!record) {
        await interaction.reply({
          content: `❌ **#${channel.name}** nincs regisztrálva log csatornaként. Előbb: \`/logchannel add\`.`,
          ephemeral: true,
        });
        return;
      }
      await prisma.logChannel.update({ where: { id: channel.id }, data: { name: label } });
      await interaction.reply({ content: `✏️ **#${channel.name}** címkéje mostantól: \`${label}\`.`, ephemeral: true });
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
        (c) =>
          `${c.enabled ? '🟢' : '🔴'} \`${c.name}\` — <#${c.id}> ${c.backfillComplete ? '(backfill kész)' : '(backfill hiányzik)'}`
      );
      await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    }
  },
};
